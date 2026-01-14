# Minerva

## Overview

Minerva combines speech recognition, language model inference, and text-to-speech synthesis into a seamless voice conversation experience. The project serves as a practical tool—users can self-host with their own API keys or try a hosted demo.

## Tech Stack

- **Speech-to-Text:** OpenAI Whisper
- **Language Model:** OpenAI GPT API
- **Text-to-Speech:** OpenAI TTS
- **Frontend:** Vanilla JavaScript
- **Backend:** Node.js (Express)
- **Database:** MySQL
- **Deployment:** Cloudflare Pages + PlanetScale

---

## User Experience

```
┌─────────────────────────────────────────────────────────────────┐
│  SELF-HOSTED USER (GitHub)                                      │
│  Clone repo → Add API key to .env → Full access                 │
├─────────────────────────────────────────────────────────────────┤
│  ANONYMOUS USER (Hosted Demo)                                   │
│  Visit site → Try 3 free recordings → Prompted to sign up       │
├─────────────────────────────────────────────────────────────────┤
│  LOGGED-IN USER                                                 │
│  Sign up → Add OpenAI API key → Unlimited usage (their cost)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Development Phases

### Phase 1: Core MVP *(Current)*

Build the foundational voice-to-voice chat loop.

- [ ] Project setup and folder structure
- [ ] MySQL database schema (conversations, messages)
- [ ] Express server with session middleware
- [ ] OpenAI service integration (Whisper, ChatGPT, TTS)
- [ ] API routes (`/api/chat`, `/api/session/reset`, `/api/audio/:filename`)
- [ ] Frontend UI shell (ChatGPT-style layout)
- [ ] Audio recording with MediaRecorder
- [ ] Real-time waveform visualization (Web Audio API)
- [ ] Frontend-backend integration
- [ ] TTS playback with replay functionality

**Goal:** Record a question, see transcript, get AI response, hear it spoken back.

---

### Phase 2: Authentication

Add user accounts to persist conversations across sessions.

- [ ] Sign up / Login / Logout flows
- [ ] Password hashing with bcrypt
- [ ] JWT token authentication
- [ ] Users table in database
- [ ] Link conversations to user accounts
- [ ] Protected routes middleware

**Goal:** Users can create accounts and access their conversations from any device.

---

### Phase 3: User API Keys + History

Let users bring their own OpenAI keys and browse past conversations.

- [ ] Settings page for API key management
- [ ] AES-256-GCM encryption for stored keys
- [ ] Conversation history page
- [ ] Audio file storage (Cloudflare R2)
- [ ] Usage tracking dashboard
- [ ] Key validation before saving

**Goal:** Users manage their own API keys securely and can revisit past conversations.

---

### Phase 4: Free Tier + Hosted Demo

Deploy publicly with a limited free tier for anonymous users.

- [ ] Landing page
- [ ] Anonymous usage tracking (3 free recordings)
- [ ] API key resolution middleware (user key vs. free tier)
- [ ] Rate limiting
- [ ] Cloudflare Pages deployment
- [ ] PlanetScale database setup
- [ ] R2 bucket for audio storage

**Goal:** Public demo where anyone can try Minerva, with a path to sign up.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                 │
│  1. User clicks record → Waveform visualizes audio              │
│  2. User clicks stop → Audio blob sent to server                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NODE.JS SERVER                             │
│  1. Send audio to Whisper → get transcript                      │
│  2. Fetch conversation history from MySQL                       │
│  3. Send messages to ChatGPT → get response                     │
│  4. Save messages to MySQL                                      │
│  5. Send response to TTS → get audio                            │
│  6. Return { transcript, response, audioUrl }                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                 │
│  1. Display user message and assistant response                 │
│  2. Auto-play TTS audio                                         │
└─────────────────────────────────────────────────────────────────┘
```

---
> 🚧 **Work in Progress** — This project is actively under development.
> (currently tying database schema to express.js server for some endpoint testing & rewriting the connection pooling)

## Getting Started

*Coming soon* — Setup instructions will be added as Phase 1 progresses.

## License

MIT

---

Built by [Issa Mohamed](https://issamohamed.com)
