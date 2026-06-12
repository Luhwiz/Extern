const { STSClient, GetCallerIdentityCommand } = require("@aws-sdk/client-sts");
const dotenv = require("dotenv");
const path = require("path");

// Load .env from project root
dotenv.config({ path: path.join(__dirname, ".env") });

async function checkAWS() {
  try {
    const client = new STSClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.replace(/\"/g, ""),
      },
    });

    const command = new GetCallerIdentityCommand({});
    const response = await client.send(command);
    console.log("SUCCESS! Credentials are valid.");
    console.log("Account:", response.Account);
    console.log("Arn:", response.Arn);
    console.log("UserId:", response.UserId);
  } catch (error) {
    console.error("ERROR: Credentials are NOT valid.");
    console.error(error.message);
  }
}

checkAWS();
