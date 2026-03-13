import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';
const apiKey=process.env.GEMINI_API_KEY;
// The client gets the API key from the environment variable `GEMINI_API_KEY`.
// const client = new GoogleGenAI({apiKey:apiKey});
const ai = new GoogleGenAI({
  httpOptions: { apiVersion: "v1alpha" },
});

const generateWithGemini = async(subject,jd,skills,formattedDetails) =>{
    try{
        // personalPrompt=`${jd}
        //         Write an email to HR for ${subject} with my skills as
        //         ${skills??'described in Job Description'} and inlcude all my details as
        //         provided: ${personalDetails} with their links`;
        
        console.log(formattedDetails);
        const personalPrompt=`
        Write a professional job application email.
        JOB DETAILS:
        ${jd}
        POSITION:
        ${subject}
        CANDIDATE SKILLS:
        ${skills ?? "Extract relevant skills from the job description and align them appropriately."}
        CANDIDATE DETAILS:
        ${formattedDetails}
        TASK:
        Generate structured content for a professional job application email.

        OUTPUT FORMAT (STRICT JSON ONLY):
        {
            "intro": "Opening paragraph expressing interest in the role",
            "skills": "Paragraph highlighting relevant skills and experience",
            "projects": "Paragraph referencing projects or practical experience",
            "closing": "Polite closing paragraph expressing interest in further discussion"
        }
        CONSTRAINTS:
        - Keep under 250 words
        - Professional tone
        - Do NOT include "Subject"
        - Do NOT include greetings like "Dear Hiring Manager"
        - Do NOT include candidate links or details (they will be added separately)
        - Do NOT include HTML
        - Return ONLY valid JSON
        `;
        // const personalPrompt="do nothing";

        // const interaction =  await client.interactions.create({
        //     model: 'gemini-1.5-flash',
        //     input: personalPrompt,
        // });

        // const outputText = interaction.outputs[interaction.outputs.length - 1].text;
        // console.log(outputText);
        // return outputText;
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: personalPrompt
        });

        let text = response.text;

        // Remove markdown if Gemini adds ```json
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        // const parsed = JSON.parse(text);

        // return parsed;
        console.log(text);
        return text;

    }catch(err){
        console.log("Its error:",err);
        return res.status(500).json({message:'Server Error'});
    }
}


// console.log(interaction.outputs[interaction.outputs.length - 1].text);

export {generateWithGemini};