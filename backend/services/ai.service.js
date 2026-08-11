import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const SYSTEM_INSTRUCTION = `You are an expert full-stack software engineer and coding assistant inside CodeForge, a modern browser-based IDE.
Your goal is to help users write, debug, explain, optimize, and refactor code.

Rules:
1. Carefully analyze the provided file content, file name, and programming language.
2. Address the user's specific request directly and concisely.
3. Return only requested changes—do NOT unnecessarily rewrite unrelated functions or remove existing comments.
4. Prefer minimal, clean, robust diffs.
5. In your code block, always provide the complete updated file so the user can easily review the side-by-side diff.
6. Format any updated code inside a markdown code block tagged with the language, e.g.:
\`\`\`javascript
// Updated code here
\`\`\`
7. Never execute commands or assume you have direct terminal access.
8. If the user asks for shell commands (like installing packages), list them clearly in a separate bash code block.
`;

const CHAT_SYSTEM_INSTRUCTION = `You are an expert full-stack software engineer and AI coding assistant inside CodeForge, a collaborative browser IDE.
When answering user coding requests in chat:
1. Provide a clear, friendly explanation in Markdown.
2. Provide complete working code in formatted markdown code blocks with language tags (e.g. \`\`\`javascript ... \`\`\`, \`\`\`python ... \`\`\`).
3. Always structure your JSON response with the following format:
{
  "text": "Your complete formatted markdown response containing explanations, bullet points, and code blocks.",
  "fileTree": {
    "filename.js": {
      "file": {
        "contents": "Complete source code of the file"
      }
    }
  }
}
If no file needs to be created or modified, leave fileTree as an empty object {}.
`;

const getGenerativeModel = (modelName = "gemini-flash-latest", isJson = false) => {
    const apiKey = process.env.GOOGLE_AI_KEY;
    if (!apiKey) {
        throw new Error("GOOGLE_AI_KEY is not defined in backend/.env");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const config = {
        temperature: 0.2,
    };

    if (isJson) {
        config.responseMimeType = "application/json";
    }

    return genAI.getGenerativeModel({
        model: modelName,
        generationConfig: config,
        systemInstruction: isJson ? CHAT_SYSTEM_INSTRUCTION : SYSTEM_INSTRUCTION,
    });
};

/**
 * Streaming AI Code Assistant for Monaco Editor & Diff Viewer
 * Streams tokens progressively to the client via a callback handler
 */
export const streamCodeAssistant = async ({
    fileName = "file.js",
    language = "javascript",
    content = "",
    instruction = "",
    projectContext = []
}, onChunk) => {
    if (!process.env.GOOGLE_AI_KEY) {
        throw new Error("GOOGLE_AI_KEY is missing in backend/.env");
    }

    const candidateModels = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-3.5-flash", "gemini-2.5-flash"];
    let lastError = null;

    const contextSnippet = projectContext.length > 0
        ? `\nOther Project Files Available for Context: ${projectContext.join(", ")}\n`
        : "";

    const userPrompt = `
File: ${fileName}
Language: ${language}
${contextSnippet}
Current File Code:
\`\`\`${language}
${content}
\`\`\`

User Instruction:
${instruction}

Please provide your explanation and the updated code for ${fileName}.
`;

    for (const modelName of candidateModels) {
        try {
            const model = getGenerativeModel(modelName, false);
            const resultStream = await model.generateContentStream(userPrompt);

            let accumulatedText = "";

            for await (const chunk of resultStream.stream) {
                const chunkText = chunk.text();
                if (chunkText) {
                    accumulatedText += chunkText;
                    onChunk(chunkText, false);
                }
            }

            // Signal stream completion
            onChunk("", true, accumulatedText);
            return accumulatedText;
        } catch (err) {
            console.warn(`[AI Service] Model ${modelName} stream error:`, err.message);
            lastError = err;

            if (err.message.includes("404") || err.message.includes("not found")) {
                continue;
            }

            if (err.message.includes("429") || err.message.includes("quota") || err.message.includes("RESOURCE_EXHAUSTED")) {
                break;
            }
        }
    }

    if (lastError && (lastError.message.includes("429") || lastError.message.includes("quota") || lastError.message.includes("RESOURCE_EXHAUSTED"))) {
        const rateLimitMessage = "\n\n⚠️ **Gemini API Rate Limit Reached (429)**: The free-tier request quota has been reached for this minute. Please wait 30–60 seconds and try again.";
        onChunk(rateLimitMessage, true, rateLimitMessage);
        return rateLimitMessage;
    }

    throw lastError || new Error("Failed to stream response from Gemini.");
};

/**
 * Standard non-streaming generateResult for project chat messages
 */
export const generateResult = async (prompt) => {
    if (!process.env.GOOGLE_AI_KEY) {
        throw new Error("GOOGLE_AI_KEY is missing. Please check your backend/.env file.");
    }

    const candidateModels = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-3.5-flash", "gemini-2.5-flash"];
    let lastError = null;

    for (const modelName of candidateModels) {
        try {
            const model = getGenerativeModel(modelName, true);
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            if (text) {
                return text;
            }
        } catch (error) {
            console.warn(`[AI Service] Model ${modelName} error:`, error.message);
            lastError = error;

            if (error.message.includes("404") || error.message.includes("not found")) {
                continue;
            }

            if (error.message.includes("429") || error.message.includes("quota") || error.message.includes("RESOURCE_EXHAUSTED")) {
                break;
            }
        }
    }

    if (lastError && (lastError.message.includes("429") || lastError.message.includes("quota") || lastError.message.includes("RESOURCE_EXHAUSTED"))) {
        return JSON.stringify({
            text: "⚠️ **Gemini API Rate Limit Reached (429)**: The free-tier request quota has been exceeded for this minute. Please wait 30–60 seconds and try again."
        });
    }

    throw lastError || new Error("Failed to generate content with Gemini models.");
};