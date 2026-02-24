import { GoogleGenAI } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return new GoogleGenAI({ apiKey });
};

export async function generateOutline(topic: string) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a detailed blog post outline for the topic: "${topic}". Return the outline in Markdown format.`,
  });
  return response.text;
}

export async function polishContent(content: string) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Rewrite and polish the following blog post content. Improve clarity, flow, and style but keep the original meaning and voice. Return Markdown only.\n\n${content}`,
  });
  return response.text;
}

export async function expandSection(section: string, context: string) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Expand on the following blog section: "${section}". 
    Context of the post so far: "${context}". 
    Write in a professional yet engaging tone. Use Markdown.`,
  });
  return response.text;
}

export async function suggestTitle(content: string) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Suggest 5 catchy titles for a blog post with the following content: "${content.substring(0, 1000)}".`,
  });
  return response.text;
}
