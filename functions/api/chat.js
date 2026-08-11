export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const userMessage = body.message;

    if (!userMessage) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // විකිපීඩියාවෙන් අදාළ තොරතුරු සෙවීම (Wikipedia API Integration)
    let wikiContext = "";
    try {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(userMessage)}&format=json&origin=*`;
      const searchRes = await fetch(searchUrl, {
        headers: { "User-Agent": "UltraAI-AcademicHub/1.0" }
      });
      const searchData = await searchRes.json();
      
      if (searchData.query && searchData.query.search.length > 0) {
        const pageTitle = searchData.query.search[0].title;
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
        const summaryRes = await fetch(summaryUrl, {
          headers: { "User-Agent": "UltraAI-AcademicHub/1.0" }
        });
        const summaryData = await summaryRes.json();
        
        if (summaryData && summaryData.extract) {
          wikiContext = `\n\nReal-time Wikipedia Reference Information for "${pageTitle}":\n${summaryData.extract}\n(Source URL: ${summaryData.content_urls?.desktop?.page || ''})`;
        }
      }
    } catch (wikiErr) {
      // විකිපීඩියා දත්ත ලබාගැනීමේදී දෝෂයක් වුවහොත් කට්‌චය බිඳ වැටීම වළක්වා ගැනීමට මෙය යොදා ඇත
      console.error("Wikipedia fetch error:", wikiErr);
    }

    // මූලික System Prompt එකට Wikipedia සන්දර්භය (Context) එකතු කිරීම
    const baseSystemPrompt = body.systemPrompt || 'You are ULTRA AI, a helpful and smart academic assistant.';
    const systemPrompt = baseSystemPrompt + wikiContext;
    const conversation = body.conversation || [];

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation,
      { role: 'user', content: userMessage }
    ];

    const response = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
      messages: messages,
      max_tokens: 2048,
      temperature: 0.7
    });

    const aiReply = response.response || "No response generated";

    return new Response(JSON.stringify({ reply: aiReply }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
