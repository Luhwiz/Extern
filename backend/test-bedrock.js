require('dotenv').config();
const { AnthropicBedrock } = require('@anthropic-ai/bedrock-sdk');

async function test() {
  try {
    const anthropic = new AnthropicBedrock({
      awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
      awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
      awsRegion: process.env.AWS_REGION || 'us-east-1',
    });

    console.log("Starting stream...");
    const stream = anthropic.messages.stream({
      model: process.env.AWS_BEDROCK_MODEL_ID || 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      system: "You are a test bot",
      messages: [{role: "user", content: "say hello"}],
    });

    stream.on('text', (text) => process.stdout.write(text));
    stream.on('end', () => console.log('\nDone.'));
    stream.on('error', (err) => console.error('\nStream error:', err));
  } catch (err) {
    console.error("Catch error:", err);
  }
}
test();
