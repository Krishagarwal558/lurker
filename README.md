# Discord Member Chatbot

A production-ready Discord bot built with Node.js, discord.js v14, Groq, dotenv, Better-SQLite3, and node-cron.

The bot behaves like another server member: it listens to every non-bot message, talks without needing to be pinged, always responds to mentions and replies, remembers server lore, and revives inactive channels.

## Features

- Listens to every guild message and ignores bots.
- 100% reply when mentioned.
- 100% reply when someone replies to the bot.
- Ambient conversation scorer instead of flat random replies.
- Default ambient sensitivity matches the old 15% vibe, with keyword messages getting a stronger score boost.
- Per-channel and per-user cooldowns.
- Groq chat completions for natural conversation.
- Last 15 channel messages included as context.
- SQLite memory for nicknames, inside jokes, favorite games, favorite topics, and running memes.
- Time-based moods: Chill, Gremlin, Delusional Confidence, Philosopher, and Sleepy NPC.
- 5% chance to react instead of replying during ambient chat.
- Occasional emoji-only micro replies like `💀`, `😭`, `fr??`, or `wait what`.
- Fake typing before natural responses.
- Idle channel reviver after 45-90 minutes.
- Admin controls for AI state, reply chance, cooldowns, blacklist, and whitelist.

## Requirements

- Node.js 20.11 or newer
- A Discord bot token
- A Groq API key

## Discord Setup

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Create an application.
3. Go to **Bot** and create a bot.
4. Copy the bot token into `.env`.
5. Enable **Message Content Intent** under privileged gateway intents.
6. Optional: enable **Presence Intent** and set `ENABLE_PRESENCE_INTENT=true` if you want Target Gremlin background checks to know when the target is online.
7. Invite the bot with these permissions:
   - View Channels
   - Send Messages
   - Read Message History
   - Add Reactions

Use this OAuth scope combination:

- `bot`
- `applications.commands` is optional because this project uses prefix commands.

## Groq Setup

1. Create a Groq account.
2. Create an API key from the Groq console.
3. Put it in `.env` as `GROQ_API_KEY`.

Default model:

```env
GROQ_MODEL=llama-3.3-70b-versatile
```

You can change the model in `.env` or `src/config.js`.

## Installation

```bash
npm install
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill in:

```env
DISCORD_TOKEN=your_discord_bot_token_here
GROQ_API_KEY=your_groq_api_key_here
```

Start the bot:

```bash
npm start
```

Development mode:

```bash
npm run dev
```

## Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | Yes |  | Discord bot token |
| `GROQ_API_KEY` | Yes |  | Groq API key |
| `DISCORD_CLIENT_ID` | No |  | Discord application client ID |
| `OWNER_ID` | No |  | Discord user ID allowed to run owner-only admin commands |
| `GROQ_MODEL` | No | `llama-3.3-70b-versatile` | Groq model |
| `COMMAND_PREFIX` | No | `!` | Prefix for commands |
| `DATABASE_PATH` | No | `./data/bot.sqlite` | SQLite database path |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, or `error` |
| `PORT` | No | `8080` | Health check HTTP port for container hosts |
| `REPLY_CHANCE` | No | `0.15` | Ambient reply chance |
| `KEYWORD_REPLY_CHANCE` | No | `0.35` | Keyword reply chance |
| `CHANNEL_COOLDOWN_SECONDS` | No | `60` | Channel cooldown |
| `USER_COOLDOWN_SECONDS` | No | `25` | User cooldown |
| `MAX_CONTEXT_MESSAGES` | No | `15` | Recent messages sent to Groq |
| `DECISION_SCORE_THRESHOLD` | No | `35` | Base score needed for ambient replies |
| `ACTIVE_CONVERSATION_USERS` | No | `3` | Distinct recent users that count as active chat |
| `FOMO_MESSAGE_COUNT` | No | `60` | Messages since bot last spoke before FOMO boost |
| `ENABLE_HOT_TAKES` | No | `true` | Enable autonomous hot takes |
| `HOT_TAKE_PROBABILITY` | No | `45` | Chance to start a hot take after requirements are met |
| `ARGUMENT_REPLY_CHANCE` | No | `65` | Reply chance during related argument mode |
| `ARGUMENT_DURATION_MINUTES` | No | `15` | Argument mode duration |
| `MINIMUM_MESSAGES_BETWEEN_HOT_TAKES` | No | `35` | Messages required before another hot take |
| `MINIMUM_MINUTES_BETWEEN_HOT_TAKES` | No | `180` | Cooldown between hot takes |
| `HOT_TAKE_ACTIVE_RECENT_MINUTES` | No | `8` | Recent activity window required for hot takes |
| `HOT_TAKE_MINIMUM_RECENT_MESSAGES` | No | `6` | Recent human messages required before hot takes |
| `HOT_TAKE_AGREEMENT_SWITCH_COUNT` | No | `2` | Agreement count before the bot flips sides |
| `ENABLE_TARGET_GREMLIN` | No | `true` | Enable Target Gremlin Mode |
| `ENABLE_PRESENCE_INTENT` | No | `false` | Enable online-status checks for Target Gremlin background roasts |
| `TARGET_USER_ID` | No |  | Optional default Gremlin target user ID |
| `CHECK_INTERVAL_MINUTES` | No | `20` | Background Gremlin check interval |
| `BASE_TRIGGER_CHANCE` | No | `0.45` | Background chance for weaker presence/recent signals |
| `ONLINE_TRIGGER_CHANCE` | No | `0.65` | Background chance when target is online |
| `RECENT_MESSAGE_TRIGGER_CHANCE` | No | `0.90` | Background chance when target spoke recently |
| `MENTION_CHANCE` | No | `0.25` | Chance to respond when someone mentions the target |
| `REPLY_CHANCE_DURING_GREMLIN` | No | `0.70` | Chance to roast when the target speaks |
| `MAX_DAILY_ROASTS` | No | `10` | Daily Gremlin roast cap |
| `MAX_MENTIONS_PER_DAY` | No | `2` | Daily target ping cap |
| `REACTION_CHANCE` | No | `0.05` | Ambient reaction chance |
| `EMOJI_ONLY_CHANCE` | No | `0.08` | Chance of an emoji-only generated reply |
| `IMPERFECTION_CHANCE` | No | `0.08` | Chance to allow tiny human-style imperfections |
| `DUPLICATE_LOOKBACK_MESSAGES` | No | `12` | Recent bot messages checked for repeated phrasing |
| `DUPLICATE_SIMILARITY_THRESHOLD` | No | `0.72` | Similarity cutoff for regenerating repeated replies |
| `REPLY_TIMEOUT_MS` | No | `10000` | Max time to wait for Groq before falling back |
| `PERSONALITY_MODE` | No | `mood` | `mood` or weighted random |
| `TYPING_MIN_MS` | No | `1800` | Minimum fake typing wait for natural replies |
| `TYPING_MAX_MS` | No | `4500` | Maximum fake typing wait for natural replies |
| `TYPING_CHARS_PER_SECOND` | No | `8` | Typing delay estimate |
| `REVIVER_MIN_MINUTES` | No | `45` | Minimum inactive minutes before reviver |
| `REVIVER_MAX_MINUTES` | No | `90` | Maximum inactive minutes before reviver |

## Commands

User commands:

```text
!memory [@user]
!stats [@user]
!forget <id|text|all>
!ping
!personality
!help
```

Admin commands require **Manage Server** or **Administrator**:

```text
!ai on
!ai off
!ai status
!replychance 15%
!cooldown channel 60
!cooldown user 25
!blacklist add #channel
!blacklist remove #channel
!blacklist list
!whitelist add #channel
!whitelist remove #channel
!whitelist clear
!whitelist list
!gremlin @user
!gremlin off
!gremlin status
```

`!enableai` and `!disableai` are also supported.

## Memory

The bot saves memory when someone says:

```text
remember my nickname is clutch king
remember that Rahul likes Valorant
remember the side quest joke
```

It can recall memory when someone asks:

```text
what do you remember
```

Memory is stored in SQLite under `data/bot.sqlite` by default.

## Ambient Decision Engine

Normal messages are scored instead of answered with a flat random roll.

Default scoring:

```text
+20 keyword
+25 question
+15 active group chat
+15 bot has been quiet
+10 bot nickname used
+30 FOMO after 60+ messages since the bot spoke
-30 bot spoke in the last 45 seconds
-20 same user triggered the last bot reply
-15 low-signal messages like "yeah" or "lol"
```

The default threshold is `35`. `REPLY_CHANCE` still works as a sensitivity nudge: higher values lower the score needed, lower values raise it.

## Hot Takes

Hot Takes are autonomous debate starters stored in `hot_takes.json`.

They only trigger when the server has been active recently, enough messages have passed since the last hot take, and the hot take cooldown has expired. Topics are stored in SQLite after use, so the same topic is not reused until the full topic pool has been exhausted.

After a hot take starts, the bot enters Argument Mode for about 10-20 minutes. During that window it replies more often to related messages, defends its current stance, keeps replies short, and can flip sides if everyone agrees too quickly.

## Target Gremlin

Target Gremlin Mode gives the bot one configured rivalry target per server. It is controlled only by Administrators or `OWNER_ID`.

```text
!gremlin @user
!gremlin off
!gremlin status
```

The bot never announces this as a feature in chat. It uses daily caps for roasts and mentions, avoids sensitive insult categories, and rotates templates so the same joke does not repeat too often.

## Configuration

Main configuration lives in `src/config.js`.

You can change:

- ambient decision threshold
- reply sensitivity
- keyword reply chance
- cooldowns
- context size
- mood schedule
- personality weights
- reaction chance
- emoji-only reply chance
- fake typing timing
- keywords
- reaction emojis
- reviver timing
- fallback reviver starters

## Deployment

The bot can run anywhere Node.js can run:

- VPS
- Docker host
- Railway
- Render
- Fly.io
- PM2 on a server

Basic PM2 example:

```bash
npm install
cp .env.example .env
npm install -g pm2
pm2 start src/index.js --name discord-member-chatbot
pm2 save
```

Keep the SQLite database on persistent storage for hosted deployments.

Back4app settings:

```text
Branch: main
Root Directory: ./
Port: 8080
Autodeploy: Yes
```

The bot exposes `/health` on port `8080` for container health checks.

## Notes

- The bot never needs to be pinged for ambient chat.
- Mentions and replies always get a response; when natural chat is disabled, the bot gives a short paused response.
- Ambient replies are scored from the conversation: keywords, questions, active chatter, FOMO, recent bot speech, same-user repeats, and low-signal messages.
- Blacklist and whitelist affect ambient chat and channel revivers.
- Prefix command replies are deterministic utility responses; natural conversation and reviver starters use Groq.
