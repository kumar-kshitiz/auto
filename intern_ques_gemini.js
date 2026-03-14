import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import fs from "fs";

const apiKey = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({
  apiKey,
});

const RESUME_PATH = "/home/kshitiz/Desktop/autoMail/resume/shubhu_res.pdf";
const MODEL_NAME = "gemini-3.1-flash-lite-preview";

const resumePdfBase64 = fs.readFileSync(RESUME_PATH).toString("base64");

const buildQuestionAnswerPrompt = (question) => `
You are helping a candidate answer job application questions using the resume provided.

Your task is to write answers that sound like they were written directly by the applicant.

RULES:
- Write in FIRST PERSON (I, my, me).
- Never say "the resume mentions", "according to the resume", or anything referring to the resume.
- Never say "Not mentioned in the resume".
- If the resume does not contain the exact information, provide a short neutral response such as:
  - "I have not worked directly on this yet, but I am eager to learn and adapt quickly."
  - "I don't have direct experience with this, but I am comfortable learning new tools and technologies."

STYLE:
- Professional but natural.
- Concise (2–4 lines maximum).
- No AI-style explanations.
- No headings.
- No bullet points.

SPECIAL RULES:
- If the question asks for a project example, describe one project from the resume naturally.
- If a portfolio, GitHub, or work sample is requested, include the GitHub link from the resume.
- If asked about availability, answer positively and clearly.

OUTPUT:
Return ONLY the answer text that should be placed in the application form.

QUESTION:
${question}
`;

const buildOptionSelectionPrompt = (question) => `
You are filling a job application form.

Question:
${question}

Return ONLY the best matching options from the list above.
Return them as a JSON array.

Example:
["Python", "JavaScript"]
`;

const answerWithGemini = async (question1, question2,JD) => {
  try {
    if (question1) {
      const contents = [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: resumePdfBase64,
          },
        },
        {
          text: buildQuestionAnswerPrompt(question1),
        },
      ];

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents,
      });

      return response.text;
    }

    if (question2) {
      const contents = [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: resumePdfBase64,
          },
        },
        {
          text: buildOptionSelectionPrompt(question2),
        },
      ];

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents,
      });

      return response.text;
    }

    if (JD) {
  const contents = [
    {
      inlineData: {
        mimeType: "application/pdf",
        data: resumePdfBase64,
      },
    },
    {
      text: `
Write a tailored cover letter using the attached resume and the job description below.

Job Description:
${JD}

Constraints:
1. Use the resume as the primary source of truth.
2. Tailor the letter to the job description.
3. Do not hallucinate qualifications, metrics, employers, education, or tools.
4. Do not use vague filler like "I am writing to express my interest" unless naturally phrased.
5. Avoid overly formal or robotic language.
6. Keep it between 220 and 320 words.
7. Make it specific, credible, and polished.
8. No bullet points, no headings, no placeholders, no markdown.
9. Output only the cover letter.

The cover letter should:
- briefly introduce the candidate,
- connect their relevant background to the role,
- highlight 2 to 4 strong matches between resume and JD,
- show genuine interest in the opportunity,
- close professionally.
      `.trim(),
    },
  ];

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents,
  });

  return response.text?.trim();
}

    return "No question provided.";
  } catch (err) {
    console.error("Error in answerWithGemini:", err);
    throw new Error("Failed to generate content");
  }
};

export { answerWithGemini };