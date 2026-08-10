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

    const systemPrompt = body.systemPrompt || 'You are ULTRA AI, a helpful and smart academic assistant.';
    const conversation = body.conversation || [];

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation,
      { role: 'user', content: userMessage }
    ];

    // Forcefully use the working model, ignoring any old/deprecated names from frontend
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: messages
    });

    const aiReply = response.response || "No response generated";

    return new Response(JSON.stringify({ reply: aiReply }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
