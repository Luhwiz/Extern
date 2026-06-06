import re

with open('backend/routes/claude.js', 'r') as f:
    content = f.read()

# Add OpenAI init
content = content.replace(
    "const Anthropic = require('@anthropic-ai/sdk');",
    "const Anthropic = require('@anthropic-ai/sdk');\nconst { OpenAI } = require('openai');\nconst openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });"
)

# Replace summarize endpoint
summarize_old = """    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: 'You are a technical summarizer. Generate concise, fact-based summaries.',
      messages: [
        {
          role: 'user',
          content: `Summarize this conversation concisely. Focus on:
- Key decisions made
- Technical choices and rationale
- Open tasks or pending work
- Important context that should be remembered

Keep it under 300 words. Be technical and precise.

Conversation:
${messages.map(m => `${m.role}: ${m.content.substring(0, 500)}`).join('\\n\\n')}

Summary:`
        }
      ],
    });

    const summary = msg.content[0].text;"""

summarize_new = """    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a technical summarizer. Generate concise, fact-based summaries.' },
        {
          role: 'user',
          content: `Summarize this conversation concisely. Focus on:
- Key decisions made
- Technical choices and rationale
- Open tasks or pending work
- Important context that should be remembered

Keep it under 300 words. Be technical and precise.

Conversation:
${messages.map(m => `${m.role}: ${m.content.substring(0, 500)}`).join('\\n\\n')}

Summary:`
        }
      ]
    });
    const summary = completion.choices[0].message.content;"""

content = content.replace(summarize_old, summarize_new)

# Replace stream loop
stream_old_start = "    // Start Anthropic stream"
stream_old_end = "      res.end();\n    });"

pattern = re.compile(re.escape(stream_old_start) + r'.*?' + re.escape(stream_old_end), re.DOTALL)

stream_new = """    // Start OpenAI stream
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: finalSystemPrompt },
        ...messages
      ],
      stream: true,
    });

    let totalTokens = 0;
    let stopReason = 'end_turn';

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        res.write(`data: ${JSON.stringify({ type: 'content_block_delta', delta: { text } })}\\n\\n`);
      }
    }

    // Finish stream
    const userRef = db.collection('users').doc(userId);
    await userRef.update({
      'usage.requestsToday': admin.firestore.FieldValue.increment(1),
      'usage.tokensToday': admin.firestore.FieldValue.increment(1000), // mock
      'usage.totalRequests': admin.firestore.FieldValue.increment(1),
      'usage.totalTokens': admin.firestore.FieldValue.increment(1000)
    });

    res.write(`data: ${JSON.stringify({ done: true, tokens: 1000, stop_reason: stopReason })}\\n\\n`);
    res.end();"""

content = pattern.sub(stream_new, content)

with open('backend/routes/claude.js', 'w') as f:
    f.write(content)

print("Done python script")
