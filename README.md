# 👾 Lurker v2.0 // Next-Gen Autonomous Discord Member AI

> An ultra-realistic, multi-model Discord bot that behaves like a real server regular — listening to chat flow, remembering lore & inside jokes, arguing hot takes, tracking relationship affinities, and speaking without needing to be pinged.

---

## ⚡ What's New in Lurker v2.0?

| Feature Dimension | Lurker v1 | Lurker v2.0 (Supercharged) |
| :--- | :--- | :--- |
| **Command System** | Prefix commands only (`!memory`, `!gremlin`) | **Dual Interface**: Full Discord **Slash Commands (`/`)** with autocomplete & interactive buttons + **Prefix Commands (`!`)** for 100% backward compatibility |
| **AI LLM Routing** | Groq only (Llama 3.3 70B) | **Multi-Provider Engine**: Groq, Google Gemini (2.0/1.5 Flash), OpenAI (GPT-4o-mini), and local Ollama with **automatic failover** |
| **Typing & Message Delivery** | Single static delay, monolithic text | **Human Mimicry Engine**: Variable WPM typing delays + **Multi-Bubble Burst Delivery** (sends 2 rapid short messages naturally) |
| **Memory & Lore System** | Strict regex "remember..." | **Hybrid Semantic & Lore Engine**: Explicit memory, **Server Lore Graph** (`!lore`), and **Member Affinity Matrix** (-100 to +100) |
| **Hot Takes Debate Arena** | 300 topics, text only | **Interactive Debate Arena**: 450+ topics across 8 categories with **Interactive Discord Voting Buttons** (Agree 🟢, Cap 🔴, Fight Me ⚔️) |
| **Target Gremlin Rivalry** | 7 template types | **50+ templates across 8 categories**: fake achievements, mysterious case files, suspicious presence callouts |
| **Personalities & Moods** | 6 static moods | **12 Rich Personalities**: Chill, Gremlin, Delusional Confidence, Philosopher, Sleepy NPC, Sarcastic Gamer, Chaotic Bro, Tech Nerd, Anime Weeb, Conspiracy Theorist, Hypeman |
| **Web Dashboard** | Basic `/health` JSON | **Full Cyberpunk Web Dashboard**: Real-time live status, memory browser/editor, lore graph manager, server metrics |

---

## 🚀 Key Features

1. **Ambient Conversation Scorer**: Analyzes questions, keywords, active chatters, FOMO, bot nicknames, and hype levels to join chat naturally without requiring pings.
2. **100% Guaranteed Replies**: Always responds when directly mentioned or replied to.
3. **Multi-Model Resilience**: Primary fast Groq inference with seamless auto-failover to Google Gemini, OpenAI, or local Ollama.
4. **Member Affinity Matrix**: Tracks relationship rapport with each server member (e.g. *Legendary Bestie*, *Trusted Friend*, *Frenemy*, *Arch-Rival*).
5. **Server Lore Graph**: Records memorable quotes, inside jokes, and server events for natural ambient recall.
6. **Interactive Hot Takes**: Spontaneously ignites controversial debates with interactive Discord poll buttons. If unanimous agreement occurs, Lurker switches sides to keep the debate alive!
7. **Target Gremlin Rivalry**: Secretly targets one chosen server member for playful banter, fake achievements, and funny accusations within daily limits.
8. **Smart Channel Reviver**: Revives dormant channels after 45-90 minutes of silence using contextual icebreakers.
9. **Anti-Repetition Guard**: Multi-tier token similarity filter to prevent repetitive replies or catchphrases.
10. **Cyberpunk Web Dashboard**: Built-in dark glass web interface on port `8080` with memory management, lore editor, and live metrics.

---

## 🛠️ Quick Start & Installation

### 1. Prerequisites
- **Node.js 20.11** or newer
- Discord Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))
- Groq API Key ([Groq Console](https://console.groq.com/keys)) or Google Gemini / OpenAI API key

### 2. Setup Discord Bot
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create an Application.
2. Under **Bot**, enable:
   - **Message Content Intent** (Required)
   - **Presence Intent** (Optional, for Target Gremlin online status checks)
3. Under **OAuth2 > URL Generator**, select `bot` and `applications.commands`.
4. Permissions required:
   - View Channels
   - Send Messages
   - Read Message History
   - Add Reactions
   - Use Slash Commands

### 3. Installation
```bash
# Clone or navigate to the directory
cd lurker

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

Fill in your `.env`:
```env
DISCORD_TOKEN=your_discord_bot_token
GROQ_API_KEY=your_groq_api_key
```

### 4. Run the Bot
```bash
# Start bot in production mode
npm start

# Or development mode with auto-reload
npm run dev

# Run automated test suite
npm test
```

Open `http://localhost:8080` in your browser to access the **Cyberpunk Mission Control Dashboard**!

---

## 🕹️ Commands Reference

### User Commands (Slash & Prefix)

| Slash Command | Prefix Command | Description |
| :--- | :--- | :--- |
| `/ping` | `!ping` | Check WebSocket and response latency |
| `/memory view [@user]` | `!memory [@user]` | Inspect stored memories |
| `/memory add <text>` | `remember that <text>` | Explicitly record a memory |
| `/memory forget <target>` | `!forget <id\|all\|text>` | Delete saved memories |
| `/stats [@user]` | `!stats [@user]` | Message statistics & server volume |
| `/affinity [@user]` | `!affinity [@user]` | Check rapport & sentiment tag with Lurker |
| `/vibe [@user]` | `!vibe [@user]` | Run an AI Vibe Check evaluation |
| `/roast [@user]` | `!roast [@user]` | Playful, lighthearted AI roast |
| `/lore [view\|add]` | `!lore [add <title: desc>]` | View or record server lore and memes |
| `/hottake` | `!hottake` | Start an interactive hot take debate with vote buttons |
| `/personality` | `!personality` | View active mood schedule & personality roulette |
| `/help` | `!help` | List all available commands |

### Admin Commands (Manage Server Required)

| Slash Command | Prefix Command | Description |
| :--- | :--- | :--- |
| `/admin ai <on\|off\|status>` | `!ai on\|off\|status` | Toggle ambient AI chatter |
| `/admin replychance <chance>` | `!replychance 15%` | Adjust ambient response sensitivity |
| `/admin cooldown <channel\|user> <sec>` | `!cooldown channel 60` | Configure message cooldowns |
| `/admin blacklist <add\|remove\|list>` | `!blacklist add #channel` | Block ambient talk in a channel |
| `/admin whitelist <add\|remove\|list>` | `!whitelist add #channel` | Restrict ambient talk to specific channels |
| `/admin gremlin <set\|off\|status>` | `!gremlin @user\|off\|status` | Configure secret rivalry target |

---

## ⚙️ Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `DISCORD_TOKEN` | *Required* | Discord Bot Token |
| `GROQ_API_KEY` | *Required** | Groq API Key |
| `GEMINI_API_KEY` | *Optional* | Google Gemini API Key (fallback provider) |
| `OPENAI_API_KEY` | *Optional* | OpenAI API Key or local Ollama URL |
| `AI_PROVIDER_ORDER` | `groq,gemini,openai` | Multi-model failover priority |
| `PORT` | `8080` | Web dashboard & healthcheck port |
| `DATABASE_PATH` | `./data/bot.sqlite` | SQLite database file location |
| `ENABLE_MULTI_BUBBLE` | `true` | Enable realistic multi-message burst delivery |
| `ENABLE_HOT_TAKE_POLLS` | `true` | Enable Discord interactive vote buttons on hot takes |
| `REPLY_CHANCE` | `0.15` | Base ambient reply sensitivity |
| `KEYWORD_REPLY_CHANCE` | `0.35` | Keyword match reply probability |
| `CHANNEL_COOLDOWN_SECONDS` | `60` | Channel cooldown duration |
| `USER_COOLDOWN_SECONDS` | `25` | User cooldown duration |
| `MAX_CONTEXT_MESSAGES` | `15` | Recent messages included in LLM context |
| `ENABLE_TARGET_GREMLIN` | `true` | Enable secret rivalry target engine |
| `MAX_DAILY_ROASTS` | `10` | Daily cap on target roasts |
| `REVIVER_MIN_MINUTES` | `45` | Minimum inactive minutes before channel reviver |
| `REVIVER_MAX_MINUTES` | `90` | Maximum inactive minutes before channel reviver |

---

## 🐳 Docker & Hosting Deployment

### Docker Compose
```bash
docker-compose up -d
```

### PM2
```bash
npm install -g pm2
pm2 start src/index.js --name lurker-v2
pm2 save
```

### Hosting on Railway / Render / Fly.io / Back4App
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Health Check Path**: `/health` on port `8080`
- **Persistent Volume**: Mount `./data` for SQLite persistence across deployments.

---

## 📜 License
MIT License. Built for Discord communities that want a bot that feels like a real friend.
