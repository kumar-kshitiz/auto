import express from 'express';
import { generateWithGemini } from './gemini.js';
import {google} from 'googleapis';
import dotenv from "dotenv";
import { refreshToken, mail } from './tempConst.js';
// import nodemailer from 'nodemailer';
const app = express();
const port=8080;

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

const user={
    email:mail,
    refreshToken: refreshToken,
};

// generate a url that asks permissions for Blogger and Google Calendar scopes
const scopes = [
  'https://www.googleapis.com/auth/blogger',
  'https://www.googleapis.com/auth/calendar'
];


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/',(req,res)=>{
    res.json('working');
});

app.post('/generate',async(req,res)=>{
    try{
        const {to,subject,jd,skills,per}=req.body;
        // const {name,email,phone,githubProfileLink,linkedinProfileLink,
        //     portfolioLink,myWorkLink} = req.body.personalDetails;
        
        const personalDetails = req.body.personalDetails;
        // console.log(personalDetails);
        const formattedDetails=Object.entries(personalDetails)
                                .map(([key,val])=>`${key}:${val}`)
                                .join("\n");
        const generatedMail = await generateWithGemini(
            subject,
            jd,
            skills,
            formattedDetails
        );
        // console.log(generatedMail);
        // res.send(generatedMail);
        return res.json({generatedMail});

    }catch(err){
        res.status(500).json({message:err});
    }
});

app.get('/auth/google',async(req,res)=>{
    const url = oauth2Client.generateAuthUrl({
        // 'online' (default) or 'offline' (gets refresh_token)
        access_type: 'offline',
        // gets refresh token everytime
        prompt: "consent",
        // If you only need one scope, you can pass it as a string
        scope: scopes
    });
    // console.log(url);
    // res.send("Authentication successful");
    res.redirect(url);
});

app.get('/auth/google/callback',async(req,res)=>{
    const {code} = req.query;
    const {tokens} = await oauth2Client.getToken(code);
    // console.log(tokens);
    // oauth2Client.setCredentials(tokens);
    oauth2Client.setCredentials({
        refresh_token:user.refreshToken
    });
    res.redirect('/sendmail');
});

app.post('/sendmail',(req,res)=>{
    try{
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: "me@gmail.com",
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
            },
        });
    }catch(err){
        res.status(500).json({message:err});
    }
});

app.listen(port,()=>{
    console.log(`${port} ilistening`);
});