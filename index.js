// import express from "express";
// import { google } from "googleapis";
// import dotenv from "dotenv";

// dotenv.config();
// const app = express();
// const PORT = 8080;

// const oauth2Client = new google.auth.OAuth2(
//   process.env.CLIENT_ID,
//   process.env.CLIENT_SECRET,
//   process.env.REDIRECT_URI
// );

// // Step 1: Redirect user to Google consent screen
// app.get("/auth/google", (req, res) => {
//   const url = oauth2Client.generateAuthUrl({
//     access_type: "offline",
//     scope: ["https://www.googleapis.com/auth/gmail.send"],
//   });
//   res.redirect(url);
// });

// // Step 2: Google redirects back here
// app.get("/auth/google/callback", async (req, res) => {
//   const { code } = req.query;

//   const { tokens } = await oauth2Client.getToken(code);
//   oauth2Client.setCredentials(tokens);

//   console.log("Refresh Token:", tokens.refresh_token);

//   res.send("Authorization successful! You can close this tab.");
// });

// // Step 3: Send email route
// app.get("/send-email", async (req, res) => {
//   const gmail = google.gmail({ version: "v1", auth: oauth2Client });

//   const message = [
//     "From: Your Name <your@gmail.com>",
//     "To: recipient@example.com",
//     "Subject: Test Email",
//     "",
//     "Hello from Gmail API using Express!",
//   ].join("\n");

//   const encodedMessage = Buffer.from(message)
//     .toString("base64")
//     .replace(/\+/g, "-")
//     .replace(/\//g, "_")
//     .replace(/=+$/, "");

//   await gmail.users.messages.send({
//     userId: "me",
//     requestBody: {
//       raw: encodedMessage,
//     },
//   });

//   res.send("Email sent successfully!");
// });

// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });