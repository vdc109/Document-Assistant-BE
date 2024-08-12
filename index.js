const express = require("express");
const { Configuration, OpenAI } = require("openai");
const { Readable } = require("stream");
var cors = require("cors");
const TextEncoder = require("util").TextEncoder;
const { NextResponse } = require("next/server");

// Load environment variables from a .env file
// require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// Set up OpenAI API configuration
// const configuration = new Configuration();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Your OpenAI API key from the environment variable
});

// Define a route to handle the text generation request
app.post("/generate", async (req, res) => {
  try {
    const data = req.body; // Get the JSON body of the incoming request
    const systemPrompt = "Your system prompt goes here"; // Customize the system prompt

    // Create a chat completion request to the OpenAI API
    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: systemPrompt }, ...data], // Include the system prompt and user messages
      model: "gpt-3.5-turbo",
      stream: true, // Enable streaming responses
    });

    // Create a Node.js Readable stream to handle the streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder(); // Create a TextEncoder to convert strings to Uint8Array
        try {
          // Iterate over the streamed chunks of the response
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content; // Extract the content from the chunk
            if (content) {
              const text = encoder.encode(content); // Encode the content to Uint8Array
              controller.enqueue(text); // Enqueue the encoded text to the stream
            }
          }
        } catch (err) {
          controller.error(err); // Handle any errors that occur during streaming
        } finally {
          controller.close(); // Close the stream when done
        }
      },
    });

    // Set headers and pipe the stream to the Express response
    res.setHeader("Content-Type", "text/plain; charset=utf-8");

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let message = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      console.log(text);
      message += text;
    }
    res.status(200).send(message);
  } catch (err) {
    console.error("Error during text generation:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
