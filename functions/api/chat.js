// api/chat.js
// ULTRA AI - Vercel AI Pipeline
// Cloudflare Workers AI removed.
// Existing Wikipedia, system prompt, conversation and mode logic preserved.

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Client-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    // ============================================================
    // VERCEL ENVIRONMENT VARIABLE
    // Add GEMINI_API_KEY in:
    // Vercel → Project → Settings → Environment Variables
    // ============================================================

    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      return res.status(500).json({
        error:
          "GEMINI_API_KEY is not configured in Vercel Environment Variables."
      });
    }

    const body = req.body || {};

    const userMessage = body.message;
    const mode = body.mode || "quick";

    if (!userMessage) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    // ============================================================
    // WIKIPEDIA CONTEXT
    // Original Cloudflare Wikipedia logic preserved
    // ============================================================

    let wikiContext = "";

    try {
      const searchUrl =
        `https://en.wikipedia.org/w/api.php` +
        `?action=query` +
        `&list=search` +
        `&srsearch=${encodeURIComponent(userMessage)}` +
        `&format=json` +
        `&origin=*`;

      const searchRes = await fetch(searchUrl, {
        headers: {
          "User-Agent": "UltraAI-AcademicHub/1.0"
        }
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();

        if (
          searchData.query &&
          Array.isArray(searchData.query.search) &&
          searchData.query.search.length > 0
        ) {
          const pageTitle = searchData.query.search[0].title;

          const summaryUrl =
            `https://en.wikipedia.org/api/rest_v1/page/summary/` +
            encodeURIComponent(pageTitle);

          const summaryRes = await fetch(summaryUrl, {
            headers: {
              "User-Agent": "UltraAI-AcademicHub/1.0"
            }
          });

          if (summaryRes.ok) {
            const summaryData = await summaryRes.json();

            if (summaryData && summaryData.extract) {
              wikiContext =
                `\n\nReal-time Wikipedia Reference Information for "${pageTitle}":\n` +
                `${summaryData.extract}\n` +
                `(Source URL: ${
                  summaryData.content_urls?.desktop?.page || ""
                })`;
            }
          }
        }
      }
    } catch (wikiErr) {
      // Wikipedia failure should NOT stop the AI response
      console.error("Wikipedia fetch error:", wikiErr);
    }

    // ============================================================
    // SYSTEM PROMPT
    // Original behavior preserved
    // ============================================================

    const baseSystemPrompt =
      body.systemPrompt ||
      "You are ULTRA AI, a helpful and smart academic assistant.";

    const systemPrompt =
      baseSystemPrompt +
      "\nCRITICAL RULE: Always write and reply strictly in English." +
      wikiContext;

    // ============================================================
    // CONVERSATION
    // Original conversation behavior preserved
    // ============================================================

    const conversation = Array.isArray(body.conversation)
      ? body.conversation
      : [];

    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...conversation,
      {
        role: "user",
        content: userMessage
      }
    ];

    // ============================================================
    // TEMPERATURE
    // Original mode logic preserved
    // ============================================================

    let temperature = 0.3;

    if (mode === "solve" || mode === "quick") {
      temperature = 0.1;
    } else if (mode === "writer" || mode === "debate") {
      temperature = 0.6;
    } else if (mode === "deep" || mode === "research") {
      temperature = 0.2;
    }

    // ============================================================
    // CONVERT CHAT MESSAGES TO GEMINI FORMAT
    // ============================================================

    const systemMessage =
      messages.find((m) => m && m.role === "system")?.content ||
      systemPrompt;

    const chatMessages = messages
      .filter((m) => m && m.role !== "system")
      .map((m) => {
        let role = "user";

        if (m.role === "assistant" || m.role === "model") {
          role = "model";
        }

        return {
          role,
          parts: [
            {
              text: String(m.content || "")
            }
          ]
        };
      })
      .filter((m) => m.parts[0].text.trim().length > 0);

    // ============================================================
    // GEMINI 2.5 FLASH
    // This replaces Cloudflare Workers AI
    // ============================================================

    const geminiUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      "gemini-2.5-flash:generateContent?key=" +
      encodeURIComponent(geminiApiKey);

    const response = await fetch(geminiUrl, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: systemMessage
            }
          ]
        },

        contents: chatMessages,

        generationConfig: {
          temperature: temperature,
          maxOutputTokens: 2048
        }
      })
    });

    const responseData = await response.json();

    // ============================================================
    // GEMINI ERROR HANDLING
    // ============================================================

    if (!response.ok) {
      const errorMessage =
        responseData?.error?.message ||
        `Gemini API request failed with status ${response.status}.`;

      return res.status(response.status).json({
        error: errorMessage
      });
    }

    // ============================================================
    // EXTRACT GEMINI RESPONSE
    // ============================================================

    const aiReply =
      responseData?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("") ||
      "No response generated";

    // ============================================================
    // RETURN SAME RESPONSE SHAPE
    // Frontend receives { reply: "..." }
    // ============================================================

    return res.status(200).json({
      reply: aiReply
    });

  } catch (err) {
    console.error("Vercel AI error:", err);

    return res.status(500).json({
      error: err?.message || "Internal server error"
    });
  }
}
