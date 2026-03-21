// ============================================================
// Feature 3 — Vision-to-Code API Route
// Accepts an image (Figma screenshot, wireframe, UI mockup)
// and generates matching component code using a vision-capable
// model. Solves Pain Point #4: Requirements Misalignment.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;
    const framework = (formData.get('framework') as string) || 'react';
    const language = (formData.get('language') as string) || 'typescript';
    const styleLibrary = (formData.get('styleLibrary') as string) || 'tailwind';
    const additionalContext = (formData.get('context') as string) || '';

    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image file provided. Send a PNG/JPG as "image" in form-data.' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: `Unsupported image type: ${imageFile.type}. Use PNG, JPG, WEBP, or GIF.` },
        { status: 400 }
      );
    }

    // Convert to base64 for vision model
    const bytes = await imageFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = imageFile.type as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

    const apiKey = req.headers.get('x-groq-key') || process.env.GROQ_API_KEY || '';
    const groq = createGroq({ apiKey });

    const systemPrompt = `You are a world-class UI developer specializing in converting design mockups and wireframes into production-ready code.

Your task: Analyze the provided UI image (Figma screenshot, wireframe, or mockup) and generate complete, working code that matches the design.

Framework: ${framework}
Language: ${language}  
Style Library: ${styleLibrary}
${additionalContext ? `Additional context: ${additionalContext}` : ''}

REQUIREMENTS:
1. Generate COMPLETE, runnable code — not placeholder comments
2. Match the layout, spacing, colors, and typography as closely as possible
3. Use semantic HTML elements (header, nav, main, section, article, footer)
4. Make it fully responsive (mobile-first)
5. Include proper accessibility attributes (aria-*, role, alt, tabIndex)
6. Decompose into reusable components where the design shows repeated patterns
7. Add hover states and basic transitions for interactive elements
8. Include all necessary imports

OUTPUT FORMAT:
Generate one or more code files in markdown code blocks with file paths:

\`\`\`tsx
// src/components/ComponentName.tsx
[complete component code]
\`\`\`

Start with the main component, then sub-components if needed.`;

    // Convert to data URL for vision model (AI SDK v6 ImagePart format)
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const { text, usage } = await generateText({
      model: groq('meta-llama/llama-4-maverick-17b-128e-instruct'),
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: dataUrl,
            },
            {
              type: 'text',
              text: 'Generate complete, production-ready code that exactly matches this UI design. Include all components needed to render this design faithfully.',
            },
          ],
        },
      ],
      maxOutputTokens: 4096,
      temperature: 0.2,
    });

    return NextResponse.json({
      success: true,
      generatedCode: text,
      tokensUsed: usage?.totalTokens || 0,
      model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
      framework,
      language,
      styleLibrary,
    });
  } catch (err) {
    console.error('[vision-to-code] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Vision-to-code failed: ${message}` },
      { status: 500 }
    );
  }
}
