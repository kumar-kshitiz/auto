import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';
import fs from "fs";
const apiKey=process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({
  httpOptions: { apiVersion: "v1alpha" },
});

const answerWithGemini = async(question) =>{
    try{
    
    console.log(question);

    const pdfBytes = fs.readFileSync(
        "/home/kshitiz/Desktop/autoMail/resume/shubhu_res.pdf"
    );

    // const contents = [
    //     {
    //         inlineData: {
    //             mimeType: 'application/pdf',
    //             data: pdfBytes.toString("base64")
    //         }
    //     },
    //     { text: `Based on the resume answer the below question in a about 2-4 lines
    //         only until not mentioned explicitly: 
    //         Question: ${question}
    //         If asked for link to your portfolio/work samples provide the link of github
    //         from resume` 
    //     }
    // ];

    const contents = [
    {
        inlineData: {
            mimeType: "application/pdf",
            data: pdfBytes.toString("base64")
        }
    },
    {
        text: `
            You are answering job application questions based strictly on the provided resume.

            INSTRUCTIONS:
            - Use only information that appears in the resume.
            - Do NOT invent or assume information.
            - Keep the answer concise (2–4 lines maximum).
            - Write in a professional tone suitable for job applications.

            SPECIAL RULE:
            - If the question asks for portfolio, projects, or work samples, provide the GitHub link found in the resume.

            If the information is not present in the resume, respond with:
            "Not mentioned in the resume."

            QUESTION:
            ${question}
            `
        }
    ];

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents
    });

    // console.log(response.text);

    return response.text;

    }catch(err){
        console.log("Its error:",err);
        return res.status(500).json({message:'Server Error'});
    }
}


// console.log(interaction.outputs[interaction.outputs.length - 1].text);

export {answerWithGemini};