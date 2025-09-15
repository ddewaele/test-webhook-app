// Import Express.js
const express = require('express');
const { Client } = require("@langchain/langgraph-sdk");

// Create an Express app
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Set port and verify_token
const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;
const whatsAppToken = process.env.WHATSAPP_API_TOKEN;

function getIncomingText(payload) {
  try {
    const msgs = payload?.entry?.[0]?.changes?.[0]?.value?.messages;
    const msg = Array.isArray(msgs) ? msgs[0] : undefined;
    if (msg?.type === "text") return msg?.text?.body?.trim();
    // You can handle other types (image, audio, etc.) here if needed
    return "Error occured";
  } catch {
    return "Error occured";
  }
}


// Route for GET requests
app.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});

// Route for POST requests
app.post('/', async (req, res) => {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`\n\nWebhook received ${timestamp}\n`);
  console.log(JSON.stringify(req.body, null, 2));

  const client = new Client({
    apiUrl: process.env.LANGCHAIN_API_URL,
  });
  const assistantId = "agent";
  const thread = await client.threads.create();

  let input = {
    messages: [{ role: "user", content: getIncomingText(req.body) }],
  };

  const runResponse = (await client.runs.wait(thread.thread_id, assistantId, {
    input,
  }))

  console.log(runResponse);

  console.log("Calling WhatsApp API");

  const url = `https://graph.facebook.com/v22.0/734754013064653/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: "32477308443",
    type: "template",
    template: {
      name: "template1",
      language: { code: "en_US" },
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: runResponse.messages[runResponse.messages.length-1].content,
            },
          ],
        },
      ],
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${whatsAppToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log("WhatsApp API response:", data);
  } catch (err) {
    console.error("Error sending WhatsApp message:", err);
  }


  res.status(200).end();
});

// Start the server
app.listen(port, () => {
  console.log(`\nListening on port ${port}\n`);
});
