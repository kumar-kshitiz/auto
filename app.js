import express from 'express';
import { generateWithGemini } from './mail_gemini.js';
import {google} from 'googleapis';
import dotenv from "dotenv";
import { GOOGLE_FROM_MAIL, GOOGLE_REFRESH_TOKEN} from './tempConst.js';
import {answerWithGemini} from './intern_ques_gemini.js';

const app = express();

dotenv.config();
const port=process.env.PORT;

const user={
    email:GOOGLE_FROM_MAIL,
    refreshToken: GOOGLE_REFRESH_TOKEN,
};

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: user.refreshToken,
});

// Gmail instance
const gmail = google.gmail({
  version: "v1",
  auth: oauth2Client,
});


// generate a url that asks permissions for Blogger and Google Calendar scopes
const scopes = [
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
];

const createDraft = async({to,subject,message}) => {
  try {
    const messageParts = [
      `From: ${user.email}`,
      `To: ${to}` ,
      `Subject: ${subject}`,
      "Content-Type: text/html; charset=utf-8",
      "",
      message,
    ];

    const messages = messageParts.join("\n");

    // Base64 URL encode
    return Buffer.from(messages)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  } catch (error) {
    console.error("An error occurred:", error.message);
    return null;
  }
}

const sendMail = async({to,subject,message})=>{
  const encodedMessage = await createDraft({to,subject,message});
  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw:encodedMessage,
    },
  });
  return response.data;
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/',(req,res)=>{
    res.json('working');
});

app.post('/generate-and-send',async(req,res)=>{
    try{
        const {to,subject,jd,skills}=req.body;
        // const {name,email,phone,githubProfileLink,linkedinProfileLink,
        //     portfolioLink,myWorkLink} = req.body.personalDetails;
        
        const personalDetails = req.body.personalDetails;
        // console.log(personalDetails);
        const formattedDetails=Object.entries(personalDetails)
                                .map(([key,val])=>`${key}:${val}`)
                                .join("\n");
        const generatedMessage = await generateWithGemini(
            subject,
            jd,
            skills,
            formattedDetails
        );

        const content = JSON.parse(generatedMessage);
        const htmlMessage = `
                        <div style="font-family: Arial, Helvetica, sans-serif; line-height:1.6; color:#333; font-size:15px;">
                        <p>Dear Hiring Manager,</p>
                        <p>
                        ${content.intro}
                        </p>
                        <p>
                        ${content.skills}
                        </p>
                        <p>
                        ${content.projects}
                        </p>
                        <p>
                        ${content.closing}
                        </p>
                        <p>
                        You can review some of my work here:
                        </p>
                        <p>
                        Portfolio: <a href="${personalDetails.portfolioLink}">${personalDetails.portfolioLink}</a><br/>
                        GitHub: <a href="${personalDetails.githubProfileLink}">${personalDetails.githubProfileLink}</a><br/>
                        LinkedIn: <a href="${personalDetails.linkedinProfileLink}">${personalDetails.linkedinProfileLink}</a>
                        </p>

                        <p style="margin-bottom: 5px;">Best Regards,</p> 
                        <p style="color:#6b7280; margin:0;"> 
                        <strong>${personalDetails.name}</strong><br/> 
                        ${personalDetails.phone} </p>

                      </div>
        `;
        // console.log(generatedMessage);
        const result = await sendMail({
          to,
          subject,
          message:htmlMessage,
        });
        // console.log(result);
        // console.log(generatedMail);
        // res.send(generatedMail);
        return res.json({generatedMessage});

    }catch(err){
        res.status(500).json({message:err});
    }
});

// app.get('/custom-answer-with-gemini',async(req,res)=>{
//   try{
//     const question = 'why should we hire you?';
//     const generatedMessage = await answerWithGemini(
//             question
//         );

//     console.log(generatedMessage);
    
//     return res.status(200).json({message:"Successfully answered by Gemini"});

//   }catch(err){
//     return res.status(500).json({message:err});
//   }
// });

// app.get('/auth/google',async(req,res)=>{
//     const url = oauth2Client.generateAuthUrl({
//         // 'online' (default) or 'offline' (gets refresh_token)
//         access_type: 'offline',
//         // gets refresh token everytime
//         prompt: "consent",
//         // If you only need one scope, you can pass it as a string
//         scope: scopes
//     });
//     // console.log(url);
//     // res.send("Authentication successful");
//     res.redirect(url);
// });

// app.get('/auth/google/callback',async(req,res)=>{
//     const {code} = req.query;
//     const {tokens} = await oauth2Client.getToken(code);
//     console.log(tokens);
//     // oauth2Client.setCredentials(tokens);
//     oauth2Client.setCredentials({
//         refresh_token:user.refreshToken
//     });
//     res.send(
//       "Authentication successful"
//     );
// });

app.listen(port,()=>{
    console.log(`${port} ilistening`);
});