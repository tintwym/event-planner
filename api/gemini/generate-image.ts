import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required.');
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return aiClient;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = (req.body || {}) as { prompt?: string };
    const prompt = body.prompt;
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt is required' });
    }

    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image',
      contents: {
        parts: [
          {
            text: `${prompt}. Ultra-luxurious, premium wedding/dinner/event mood board concept, photorealistic, architectural digest style, warm lighting.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: '16:9',
        },
      },
    });

    let imageUrl = '';
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64 = part.inlineData.data;
          const mime = part.inlineData.mimeType || 'image/png';
          imageUrl = `data:${mime};base64,${base64}`;
          break;
        }
      }
    }

    if (imageUrl) {
      return res.json({ success: true, imageUrl });
    }
    return res
      .status(500)
      .json({ success: false, error: 'Gemini did not return any image data.' });
  } catch (error: any) {
    console.error(`Error generating mood board image: ${error?.message || error}`);
    return res
      .status(500)
      .json({ success: false, error: error?.message || 'Failed to generate image' });
  }
}
