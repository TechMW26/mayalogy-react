const getEnv = (key) => (typeof process !== 'undefined' && process?.env ? process.env[key] : undefined);
const browserSecrets = typeof window !== 'undefined' ? (window.MAYA_SECRETS || {}) : {};

const GEMINI_API_KEY = getEnv('GEMINI_API_KEY') || getEnv('NEXT_PUBLIC_GEMINI_API_KEY') || browserSecrets.GEMINI_KEY;
const OPENAI_API_KEY = getEnv('OPENAI_API_KEY') || getEnv('NEXT_PUBLIC_OPENAI_API_KEY') || browserSecrets.OPENAI_KEY;
const PERPLEXITY_API_KEY = getEnv('PERPLEXITY_API_KEY') || browserSecrets.PERPLEXITY_KEY;

// Models to try in order of preference for text (updated for 2026)
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash', 
  'gemini-2.0-flash-lite'
];

// Vision-capable models in order of preference (updated for 2026)
// Note: Gemini has more lenient content policies for workplace screenshots
const GEMINI_VISION_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite'
];

// Perplexity models
const PERPLEXITY_MODELS = [
  'sonar-pro',
  'sonar',
  'llama-3.1-sonar-large-128k-online'
];

/**
 * Check if an error/response indicates content policy violation
 */
function isContentPolicyError(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes('unable to') ||
    lower.includes('cannot analyze') ||
    lower.includes('cannot process') ||
    lower.includes('cannot identify') ||
    lower.includes("can't analyze") ||
    lower.includes("i'm sorry") ||
    lower.includes('content policy') ||
    lower.includes('safety') ||
    lower.includes('inappropriate') ||
    lower.includes('not allowed') ||
    lower.includes('violates') ||
    lower.includes('harmful') ||
    lower.includes('blocked')
  );
}

/**
 * Fallback to Perplexity for text generation (3rd fallback)
 */
async function generatePerplexityContent(prompt, systemInstruction = '') {
  if (!PERPLEXITY_API_KEY) {
    throw new Error('Perplexity API key not configured for fallback');
  }

  console.log('🔮 Falling back to Perplexity AI...');
  
  for (const model of PERPLEXITY_MODELS) {
    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemInstruction || 'You are MAYA, a cosmic guide trained on Vedic scriptures, Gita, astrology, numerology, and Pythagorean number theorems.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 4096
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Perplexity succeeded with model: ${model}`);
        return data.choices?.[0]?.message?.content || '';
      }

      if (response.status === 404 || response.status === 400) {
        console.warn(`⚠️ Perplexity model ${model} not available, trying next...`);
        continue;
      }

      const errorText = await response.text();
      console.error(`Perplexity API error with ${model}: ${response.status}`, errorText);
      
      if (response.status === 429) {
        throw new Error(`Perplexity rate limited: ${errorText}`);
      }
    } catch (error) {
      if (error.message.includes('rate limited')) throw error;
      console.error(`Perplexity ${model} failed:`, error.message);
    }
  }

  throw new Error('All Perplexity models failed');
}

/**
 * Generate text with OpenAI first, then allow deeper fallbacks upstream.
 */
async function generateOpenAIContent(prompt, systemInstruction = '') {
  if (!OPENAI_API_KEY) {
    if (PERPLEXITY_API_KEY) {
      return generatePerplexityContent(prompt, systemInstruction);
    }
    throw new Error('OpenAI API key not configured for fallback');
  }

  console.log('🤖 Trying OpenAI first (gpt-4o-mini)...');
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemInstruction || 'You are MAYA, a cosmic guide trained on Vedic scriptures, Gita, astrology, numerology, and Pythagorean number theorems.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status}`, errorText);
      
      if (PERPLEXITY_API_KEY) {
        console.warn('⚠️ OpenAI failed, trying Perplexity...');
        return generatePerplexityContent(prompt, systemInstruction);
      }
      
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ OpenAI succeeded');
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    if (PERPLEXITY_API_KEY && !error.message.includes('Perplexity')) {
      console.warn('⚠️ OpenAI failed, trying Perplexity...', error.message);
      return generatePerplexityContent(prompt, systemInstruction);
    }
    throw error;
  }
}

/**
 * Try Gemini Vision with ALL images - no skipping
 * If Gemini fails, caller should try fallback providers with the same images
 */
async function tryGeminiVision(prompt, images) {
  const parts = [];
  images.forEach(img => {
    parts.push({
      inline_data: {
        mime_type: img.mimeType || 'image/png',
        data: img.data
      }
    });
  });
  parts.push({ text: prompt });

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json'
    },
    // Add safety settings to be more permissive for workplace content
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
    ]
  };

  // Try each Gemini model
  for (const model of GEMINI_VISION_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    
    try {
      console.log(`🔷 Trying Gemini Vision model: ${model} with ${images.length} images...`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Check if response is a content policy refusal
        if (isContentPolicyError(text)) {
          console.warn(`⚠️ Gemini ${model} returned content policy message, trying next model...`);
          continue; // Try next model
        }
        
        console.log(`✅ Gemini Vision succeeded with model: ${model} (${images.length} images)`);
        return { success: true, text, imagesUsed: images.length };
      }

      // Handle specific error codes
      if (response.status === 400) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error?.message?.toLowerCase().includes('safety') ||
            errorData.error?.message?.toLowerCase().includes('block')) {
          console.warn(`⚠️ Gemini ${model} blocked due to safety, trying next model...`);
          continue; // Try next model
        }
      }

      if (response.status === 404) {
        console.warn(`⚠️ Gemini Vision model ${model} not found, trying next...`);
        continue;
      }

      if (response.status === 503) {
        console.warn(`⚠️ Gemini Vision model ${model} overloaded, trying next...`);
        continue;
      }

      if (response.status === 429) {
        console.warn(`⚠️ Gemini Vision rate limited on ${model}`);
        return { success: false, rateLimited: true, error: 'Rate limited' };
      }

      const errorText = await response.text();
      console.error(`Gemini Vision API error with ${model}: ${response.status}`, errorText);
    } catch (error) {
      console.error(`Gemini Vision ${model} failed:`, error.message);
    }
  }
  
  // All Gemini models failed
  console.warn('⚠️ All Gemini Vision models failed');
  return { success: false, error: 'All Gemini models failed' };
}

/**
 * Generate content using OpenAI first, then Gemini, then Perplexity.
 * Fallback chain: OpenAI → Gemini → Perplexity
 */
export async function generateContent(prompt, systemInstruction = '') {
  if (!OPENAI_API_KEY && !GEMINI_API_KEY) {
    if (PERPLEXITY_API_KEY) return generatePerplexityContent(prompt, systemInstruction);
    console.error('No AI API keys configured');
    throw new Error('AI service is not configured');
  }

  if (OPENAI_API_KEY) {
    try {
      return await generateOpenAIContent(prompt, systemInstruction);
    } catch (error) {
      console.warn('⚠️ OpenAI failed, falling back to Gemini...', error.message);
    }
  }

  if (!GEMINI_API_KEY) {
    if (PERPLEXITY_API_KEY) return generatePerplexityContent(prompt, systemInstruction);
    throw new Error('Gemini API key not configured for fallback');
  }

  const payload = {
    contents: [{
      parts: [{
        text: systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt
      }]
    }],
    generationConfig: {
      temperature: 0.7,
    }
  };

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Gemini succeeded with model: ${model}`);
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      if (response.status === 404) {
        console.warn(`⚠️ Gemini model ${model} not found, trying next...`);
        continue;
      }

      if (response.status === 503) {
        console.warn(`⚠️ Gemini model ${model} overloaded, trying next...`);
        continue;
      }

      if (response.status === 429) {
        console.warn(`⚠️ Gemini rate limited, falling back to Perplexity...`);
        if (PERPLEXITY_API_KEY) {
          return generatePerplexityContent(prompt, systemInstruction);
        }
        throw new Error('Gemini rate limited and no Perplexity fallback configured');
      }

      const errorText = await response.text();
      console.error(`Gemini API error with ${model}: ${response.status}`, errorText);
    } catch (error) {
      console.error(`Gemini ${model} failed:`, error.message);
    }
  }

  console.warn('⚠️ All Gemini models failed, falling back to Perplexity...');
  if (PERPLEXITY_API_KEY) {
    return generatePerplexityContent(prompt, systemInstruction);
  }
  throw new Error('OpenAI failed and all Gemini models failed');
}

/**
 * Generate content from text and images using AI Vision APIs
 * 
 * IMPORTANT: This function tries ALL images with each provider - NO screenshot skipping.
 * If one provider fails, it falls back to the next provider with the same full set of images.
 * 
 * Fallback chain: OpenAI Vision → Gemini Vision → Error
 * 
 * @param {string} prompt - The analysis prompt
 * @param {Array} images - Array of {data: base64, mimeType: string}
 * @returns {Promise<string>} - AI analysis result
 */
export async function generateVisionContent(prompt, images = []) {
  console.log(`[Vision] Starting analysis with ${images.length} images (NO screenshot skipping)`);
  
  // Try OpenAI Vision first with ALL images (no reduction)
  if (OPENAI_API_KEY) {
    console.log('[Vision] Trying OpenAI Vision with all', images.length, 'images...');
    try {
      const result = await generateOpenAIVisionContent(prompt, images);
      if (result && !isContentPolicyError(result)) {
        console.log('[Vision] OpenAI Vision succeeded with all images');
        return result;
      }
      console.log('[Vision] OpenAI Vision returned content policy error');
    } catch (openaiError) {
      console.error('[Vision] OpenAI Vision failed:', openaiError.message);
    }
  } else {
    console.log('[Vision] No OpenAI API key, skipping to Gemini...');
  }

  // Try Gemini Vision as fallback with ALL images
  if (GEMINI_API_KEY) {
    console.log('[Vision] Trying Gemini Vision with all images...');
    const geminiResult = await tryGeminiVision(prompt, images);

    if (geminiResult.success) {
      return geminiResult.text;
    }

    console.log('[Vision] Gemini failed:', geminiResult.error || 'unknown error');
  }
  
  // All attempts failed - throw error (no fake data)
  console.error('❌ All vision AI attempts failed with', images.length, 'images');
  throw new Error('AI_VISION_FAILED: Unable to analyze screenshots. All AI services failed. Please try again later.');
}

/**
 * Fallback to OpenAI for vision/multimodal generation
 */
async function generateOpenAIVisionContent(prompt, images = []) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  console.log('🤖 Trying OpenAI Vision (gpt-4o)...');

  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        ...images.map(img => ({
          type: 'image_url',
          image_url: {
            url: `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`,
            detail: 'low'
          }
        }))
      ]
    }
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: messages,
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OpenAI Vision API error: ${response.status}`, errorText);
    throw new Error(`OpenAI Vision API error: ${response.status}`);
  }

  const data = await response.json();
  const result = data.choices?.[0]?.message?.content || '';
  console.log('✅ OpenAI Vision response received, length:', result.length);
  return result;
}

/**
 * Check which AI services are available
 */
export function getAIAvailability() {
  return {
    gemini: !!GEMINI_API_KEY,
    openai: !!OPENAI_API_KEY,
    perplexity: !!PERPLEXITY_API_KEY,
    anyAvailable: !!(GEMINI_API_KEY || OPENAI_API_KEY || PERPLEXITY_API_KEY)
  };
}
