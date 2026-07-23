require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const GeminiKeyPool = require('./geminiPool');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Initialize key pools
const roadmapPool = new GeminiKeyPool('Roadmap', [
  process.env.GEMINI_ROADMAP_KEY_1,
  process.env.GEMINI_ROADMAP_KEY_2,
  process.env.GEMINI_ROADMAP_KEY_3
]);

const chatPool = new GeminiKeyPool('Chat', [
  process.env.GEMINI_CHAT_KEY_1,
  process.env.GEMINI_CHAT_KEY_2,
  process.env.GEMINI_CHAT_KEY_3
]);

const visualizePool = new GeminiKeyPool('Visualize', [
  process.env.GEMINI_VISUALIZE_KEY_1,
  process.env.GEMINI_VISUALIZE_KEY_2,
  process.env.GEMINI_VISUALIZE_KEY_3
]);

// Helper to scrape DuckDuckGo search results
async function scrapeDuckDuckGo(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 8000
    });

    const html = response.data;
    const results = [];
    
    // We can extract search result links using regex
    // DuckDuckGo HTML format: <a class="result__url" href="URL">...</a>
    // and <a class="result__snippet" ...>
    // Let's do simple matching:
    const linkRegex = /<a class="result__snippet"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const titleRegex = /<a class="result__results_title"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

    let match;
    const titles = [];
    while ((match = titleRegex.exec(html)) !== null) {
      const url = match[1];
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      titles.push({ url, title });
    }

    const snippets = [];
    const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    while ((match = snippetRegex.exec(html)) !== null) {
      snippets.push(match[1].replace(/<[^>]+>/g, '').trim());
    }

    for (let i = 0; i < Math.min(titles.length, 5); i++) {
      results.push({
        title: titles[i].title,
        url: titles[i].url,
        snippet: snippets[i] || ''
      });
    }

    return results;
  } catch (err) {
    console.error('Error scraping DuckDuckGo:', err.message);
    return [];
  }
}

// REST Endpoints

// Explain Code
app.post('/api/explain', async (req, res) => {
  const { code, language } = req.body;
  if (!code) return res.status(400).json({ error: 'Code is required' });

  const prompt = `Explain the following ${language || 'code'} program step by step:
\`\`\`${language || ''}
${code}
\`\`\``;

  const systemInstruction = `You are an expert software developer and educator. Provide a structured explanation containing:
1. Code recap: What is this program trying to do?
2. Compilation and Run Commands: What commands are used to compile and execute this in ${language || 'its standard environment'}?
3. Step-by-step logic explanation: Break it down in plain English.
Keep response concise and format in markdown.`;

  try {
    const explanation = await visualizePool.callGemini(prompt, systemInstruction);
    res.json({ explanation });
  } catch (error) {
    console.error('Explain code error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Visualize (Mermaid.js diagram syntax)
app.post('/api/visualize', async (req, res) => {
  const { code, output, language } = req.body;
  if (!code) return res.status(400).json({ error: 'Code is required' });

  const prompt = `Code:
\`\`\`${language || ''}
${code}
\`\`\`
Last Execution Output:
\`\`\`
${output || '(No execution output)'}
\`\`\``;

  const systemInstruction = `You are a visual code analyzer. Read the provided code and its execution output, and generate a clean Mermaid.js flowchart (graph TD) that visually traces the code logic (including conditionals, function calls, and loops). 
Only output raw Mermaid.js code inside a markdown block. Do not write any conversational text. Use node labels to indicate the lines of code or operations, e.g. A[Start] --> B[Initialize x = 5]`;

  try {
    const diagram = await visualizePool.callGemini(prompt, systemInstruction);
    res.json({ diagram });
  } catch (error) {
    console.error('Visualize code error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Light Assistant Chat (Streaming fallback using standard HTTP)
app.post('/api/chat', async (req, res) => {
  const { message, codeContext, language, history } = req.body;
  
  const systemInstruction = `You are CodeQuest's built-in Light AI Assistant. Help the student with questions about code, debugging, or concepts.
You have access to their active code:
\`\`\`${language || ''}
${codeContext || ''}
\`\`\``;

  try {
    const prompt = message; // Or construct full history
    const response = await chatPool.callGemini(prompt, systemInstruction);
    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Generate Roadmap
app.post('/api/roadmap/generate', async (req, res) => {
  const { topic, duration_weeks } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic is required' });

  const weeks = parseInt(duration_weeks, 10) || 2;
  console.log(`Generating roadmap for topic: ${topic} (${weeks} weeks)`);

  // Gather web resources using DuckDuckGo
  const searchResults = await scrapeDuckDuckGo(`${topic} tutorials docs guide`);
  
  const systemInstruction = `You are a curriculum designer. Create a highly personalized learning roadmap for a student on the topic: "${topic}" spanning ${weeks} weeks.
Use the following gathered web results as inspiration for resource URLs where applicable:
${JSON.stringify(searchResults)}

You MUST output your response in JSON format. The response must be a single JSON object matching the following structure:
{
  "topic": "${topic}",
  "duration_weeks": ${weeks},
  "phases": [
    {
      "order_index": 1,
      "title": "Phase title",
      "description": "Short description",
      "resources": [
        {
          "name": "Resource Name",
          "url": "Resource URL (must be valid, prefer official docs or tutorials)"
        }
      ],
      "practice_template": "Starter boilerplate code or exercise comment instructions for this phase"
    }
  ]
}

Provide around 2 phases per week. Keep the practice_template useful so the student can directly practice writing code for that phase.`;

  const prompt = `Generate a ${weeks}-week roadmap for "${topic}".`;

  try {
    const responseText = await roadmapPool.callGemini(prompt, systemInstruction, true);
    
    // Parse json
    let roadmapData;
    try {
      roadmapData = JSON.parse(responseText.trim());
    } catch (e) {
      // Fallback parse in case of markdown block wrap
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        roadmapData = JSON.parse(jsonMatch[0]);
      } else {
        throw e;
      }
    }
    
    res.json(roadmapData);
  } catch (error) {
    console.error('Roadmap generate error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Socket.io for real-time collaboration / terminal streams
io.on('connection', (socket) => {
  console.log('Client connected to Socket.io server:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`CodeQuest server running on port ${PORT}`);
});
