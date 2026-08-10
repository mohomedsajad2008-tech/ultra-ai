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

    // Cloudflare Workers AI මඟින් Llama මෝඩල් එක ධාවනය කිරීම
    const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
            { role: 'system', content: 'You are ULTRA AI, a helpful and smart academic assistant.' },
            { role: 'user', content: userMessage }
          ]
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
