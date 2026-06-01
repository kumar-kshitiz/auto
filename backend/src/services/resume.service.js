import fs from 'fs';
import pdf from 'pdf-parse';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SKILLS_LIST = [
  'React', 'Node.js', 'Express', 'MongoDB', 'PostgreSQL', 
  'JavaScript', 'TypeScript', 'Python', 'C++', 'Docker', 
  'AWS', 'Redis', 'Next.js'
];


const extractTextFromPDF = async (filePath) => {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  return data.text;
};


const extractSkills = (text) => {
  const extractedSkills = [];
  const lowerText = text.toLowerCase();

  for (const skill of SKILLS_LIST) {
    
    if (lowerText.includes(skill.toLowerCase())) {
      extractedSkills.push(skill);
    }
  }

  return extractedSkills;
};


export const processResume = async (filePath, filename) => {
  try {
    // Extract text
    const extractedText = await extractTextFromPDF(filePath);
    
    // Extract skills
    const extractedSkills = extractSkills(extractedText);
    
    // Save to database
    const savedResume = await prisma.resume.create({
      data: {
        filename,
        extractedText,
        extractedSkills: JSON.stringify(extractedSkills),
      }
    });

    return {
      ...savedResume,
      extractedSkills: JSON.parse(savedResume.extractedSkills)
    };
  } catch (error) {
    console.error('Error processing resume:', error);
    throw error;
  }
};
