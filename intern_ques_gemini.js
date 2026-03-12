import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';
const apiKey=process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({
  httpOptions: { apiVersion: "v1alpha" },
});

const generateWithGemini = async(question) =>{
    try{
        
        console.log(question);

        const answerPrompt=``;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: answerPrompt
        });

    }catch(err){
        console.log("Its error:",err);
        return res.status(500).json({message:'Server Error'});
    }
}


// console.log(interaction.outputs[interaction.outputs.length - 1].text);

export {generateWithGemini};