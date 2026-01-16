
import { GoogleGenAI } from "@google/genai";
import { Match, User } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function analyzeMatchHistory(matches: Match[], players: User[]) {
  const prompt = `
    Analyze the following badminton match history and provide:
    1. A summary of current player performance.
    2. Prediction for future matches based on scoring trends.
    3. Training recommendations for the lower-ranked participants.

    Match Data: ${JSON.stringify(matches.map(m => ({
      scores: m.scores,
      winner: players.find(p => p.id === m.winnerId)?.name
    })))}
    Players: ${JSON.stringify(players.map(p => ({ name: p.name, credits: p.credits })))}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Unable to analyze history at this time.";
  }
}
