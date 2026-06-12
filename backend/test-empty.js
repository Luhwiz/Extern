require('dotenv').config();
const { AnthropicBedrock } = require('@anthropic-ai/bedrock-sdk');

const anthropic = new AnthropicBedrock({
  awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
  awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsRegion: process.env.AWS_REGION || 'us-east-1',
});

async function run() {
  try {
    const stream = anthropic.messages.stream({
      model: process.env.AWS_BEDROCK_MODEL_ID || 'claude-3-5-sonnet-20241022',
      max_tokens: 60000,
      messages: [{ role: "user", content: "" }],
    });

    stream.on('text', (t) => console.log('Text:', t));
    stream.on('error', (e) => {
        console.log('Stream Error emitted:', e.message);
    });
    stream.on('end', () => console.log('Stream ended'));

  } catch (e) {
    console.log('Outer catch block:', e.message);
  }
}
run();
