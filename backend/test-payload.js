require('dotenv').config();
const { AnthropicBedrock } = require('@anthropic-ai/bedrock-sdk');

const anthropic = new AnthropicBedrock({
  awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
  awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsRegion: process.env.AWS_REGION || 'us-east-1',
});

async function run() {
  try {
    const finalSystemPrompt = "You are a software developer.";
    const messages = [
      { role: "user", content: "what is happen here what is the issue, why is the AI not responding" }
    ];

    console.log('Sending stream request...');
    const stream = anthropic.messages.stream({
      model: process.env.AWS_BEDROCK_MODEL_ID || 'claude-3-5-sonnet-20241022',
      max_tokens: 60000,
      system: finalSystemPrompt,
      messages: messages,
    });

    stream.on('text', (t) => console.log('Text:', t));
    stream.on('error', (e) => {
        console.log('Stream Error emitted:', e.message);
    });
    stream.on('end', () => console.log('Stream ended'));

    // Wait for stream to finish or error
    await new Promise((resolve) => {
      stream.on('end', resolve);
      stream.on('error', resolve);
    });
    console.log('Promise resolved.');
  } catch (e) {
    console.log('Outer catch block:', e.message);
  }
}
run();
