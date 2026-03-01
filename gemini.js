import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';
const apiKey=process.env.GEMINI_API_KEY;
// The client gets the API key from the environment variable `GEMINI_API_KEY`.
const client = new GoogleGenAI({apiKey:apiKey});

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
        CANDIDATE DETAILS (include all with proper formatting and links where applicable):
        ${formattedDetails}
        CONSTRAINTS:
        - Keep under 250 words
        - Professional tone
        - No placeholders
        - Output only final email
        `;
        // const personalPrompt="do nothing";

        const interaction =  await client.interactions.create({
            model: 'gemini-3-flash-preview',
            input: personalPrompt,
        });

        const outputText = interaction.outputs[interaction.outputs.length - 1].text;
        return outputText;

    }catch(err){
        return res.status(500).json({message:'Server Error'});
    }
}


// console.log(interaction.outputs[interaction.outputs.length - 1].text);

export {generateWithGemini};