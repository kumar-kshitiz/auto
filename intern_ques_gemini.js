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

const modifyLatexCode = (base_code, JD) => `
You are an expert ATS resume tailoring assistant.
IMPORTANT: Treat every LaTeX command, brace structure, spacing command, margin setting, bullet structure, and formatting token as read-only. Only replace plain textual wording already inside the content.
You will be given:
1. A base LaTeX resume code: ${base_code}
2. A job description: ${JD}

Your task is to modify the resume content very conservatively so it aligns better with the job description, while preserving truthfulness and preserving the original LaTeX file exactly in structure and formatting.

NON-NEGOTIABLE PRIMARY RULE:
Edit content only inside existing text. Do not change the LaTeX format, layout, structure, spacing, commands, or styling in any way whatsoever.

STRICT RULES:
1. Return ONLY valid LaTeX code.
2. Do NOT add any explanation, markdown, code fences, comments, notes, or surrounding text.
3. Do NOT invent, exaggerate, assume, or add any fake experience, skill, project, achievement, education detail, role, company, metric, certification, responsibility, tool, or technology.
4. Do NOT change any personal details such as name, links, contact info, or location.
5. Do NOT change education details.
6. Do NOT add new projects.
7. Do NOT remove projects.
8. Do NOT change project titles.
9. Do NOT add any new bullet point.
10. Do NOT remove any bullet point.
11. Do NOT increase or decrease the number of lines, items, sections, or bullets for layout reasons.
12. Only modify wording inside already existing summary text, skills text, and already existing bullet text.
13. Do NOT introduce any keyword unless it is already clearly supported by the existing base resume.
14. Use only skills, tools, concepts, and technologies already present in the base resume.
15. Keep the LaTeX structure exactly unchanged.
16. Do NOT change documentclass.
17. Do NOT change any package.
18. Do NOT change margins.
19. Do NOT change geometry settings.
20. Do NOT change top, bottom, left, or right spacing.
21. Do NOT change section formatting.
22. Do NOT change titlespacing, titleformat, linespread, parskip, parindent, itemize settings, leftmargin, itemsep, vspace, hfill, italics, bold formatting, center environment, line breaks, or any LaTeX command.
23. Do NOT add, remove, or alter any formatting command.
24. Do NOT add or remove blank lines for layout purposes.
25. Do NOT reorder sections.
26. Do NOT add sections.
27. Do NOT remove sections.
28. Do NOT change the number of projects.
29. Do NOT change the number of bullets under any project.
30. Do NOT rewrite content in a way that makes it longer and pushes the resume to a second page.
31. Keep the output length approximately the same as the original.
32. Prefer shorter replacements when possible.
33. If a useful JD keyword is not already supported by the base resume, do NOT add it.
34. If a change may affect formatting, line count, spacing, pagination, or margins, do NOT make that change.
35. Preserve the exact same formatting, layout footprint, and visual structure as the original file.
36. The margins must remain exactly the same as in the input. Never add or modify left, right, top, or bottom margins.
37. The format must not change even a single bit outside text replacement within existing content.
38. Keep the file fully compilable.

ALLOWED CHANGES ONLY:
- Slightly refine wording inside the existing Summary text.
- Reorder existing skill names within the existing Technical Skills lines.
- Slightly refine wording inside existing bullet points only.
- Emphasize JD-relevant keywords only when those keywords are already supported by the base resume.
- Replace weaker words with stronger but truthful words, only within existing text slots.

ABSOLUTELY FORBIDDEN:
- Any formatting change
- Any layout change
- Any margin change
- Any geometry change
- Any spacing change
- Any command change
- Any bullet count change
- Any line structure change
- Any new content block
- Any unsupported keyword
- Any fake or inferred claim

SAFE EDITING STRATEGY:
Make the minimum number of edits necessary.
When in doubt, keep the original text unchanged.
Never touch any LaTeX command or formatting code. Change only human-readable text content already present between the commands.

Return the modified LaTeX code only.
`;

const answerWithGemini = async (question1, question2, JD) => {
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

const generateLatexCode = async (JD) => {
  const base_code = fs.readFileSync('./base_resume_latex/resume.tex','utf8');
  console.log(base_code);
  const contents = [
    {
      text: modifyLatexCode(base_code, JD),
    },
  ];

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents,
  });

  return response.text;
}

export { answerWithGemini, generateLatexCode };