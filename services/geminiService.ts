
import { GoogleGenAI, Type } from "@google/genai";
import { LevelData, BubbleColor } from "../types";
import { COLOR_LIST } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateLevel = async (difficulty: number): Promise<LevelData> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a bubble shooter level for difficulty level ${difficulty}. 
    The grid should be 12 columns by 8 rows (initial state). 
    Use the following colors: ${COLOR_LIST.join(', ')}. 
    Occasionally include a "bomb" bubble which clears nearby area.
    Return a JSON object with a level name, a description, and the grid as an array of arrays where null means empty.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          grid: {
            type: Type.ARRAY,
            items: {
              type: Type.ARRAY,
              items: { 
                type: Type.STRING,
                description: "One of: pink, orange, yellow, green, cyan, blue, bomb or null"
              }
            }
          }
        },
        required: ["name", "grid", "description"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text);
    return data as LevelData;
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    // Fallback level with some bombs
    return {
      name: "Standard Level",
      description: "A standard challenge",
      grid: Array(8).fill(null).map((_, r) => 
        Array(12).fill(null).map(() => {
          if (Math.random() < 0.05) return 'bomb' as BubbleColor;
          return COLOR_LIST[Math.floor(Math.random() * COLOR_LIST.length)];
        })
      )
    };
  }
};

export const getCommentary = async (event: string, score: number): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are a hype-man for a bubble shooter game. The player just ${event}. Their current score is ${score}. Give a short, punchy 1-sentence reaction in Chinese.`,
  });
  return response.text || "太棒了！";
};
