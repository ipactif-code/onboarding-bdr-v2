# AI Sales Trainer - Quickstart Guide

**Feature**: AI Sales Trainer | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This guide covers local development setup for all components of the AI Sales Trainer system.

## Prerequisites

### Required Software

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 22.x LTS | Next.js frontend |
| pnpm | 9.x | Package manager |
| Python | 3.11+ | LiveKit agent |
| uv | Latest | Python package manager |
| Docker | Latest | Local services (optional) |

### Required Accounts & API Keys

| Service | Purpose | Dashboard |
|---------|---------|-----------|
| Convex | Backend database | https://dashboard.convex.dev |
| Clerk | Authentication | https://dashboard.clerk.com |
| LiveKit | WebRTC infrastructure | https://cloud.livekit.io |
| Deepgram | Speech-to-Text | https://console.deepgram.com |
| Anthropic | Claude LLM | https://console.anthropic.com |
| Cartesia | Text-to-Speech | https://play.cartesia.ai |
| Simli | Avatar rendering | https://simli.com/dashboard |
| D-ID (fallback) | Avatar rendering | https://studio.d-id.com |

## Environment Setup

### 1. Clone and Install Dependencies

```bash
# Clone repository (if not already cloned)
cd onboarding-bdr-v2

# Install Node.js dependencies
pnpm install

# Install Python agent dependencies (in agent/ folder)
cd agent
uv venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
uv pip install -e ".[dev]"
cd ..
```

### 2. Environment Variables

Create `.env.local` in the project root:

```bash
# =============================================================================
# CONVEX
# =============================================================================
# Auto-populated by `npx convex dev`
CONVEX_DEPLOYMENT=dev:your-deployment-name
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# =============================================================================
# CLERK (Authentication)
# =============================================================================
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# =============================================================================
# LIVEKIT (WebRTC)
# =============================================================================
NEXT_PUBLIC_LIVEKIT_URL=wss://your-app.livekit.cloud
LIVEKIT_API_KEY=API...
LIVEKIT_API_SECRET=secret...

# =============================================================================
# AI SERVICES (Server-side only - used by Python agent)
# =============================================================================
DEEPGRAM_API_KEY=dg_...
ANTHROPIC_API_KEY=sk-ant-...
CARTESIA_API_KEY=cart_...
SIMLI_API_KEY=simli_...
DID_API_KEY=did_...  # Fallback avatar

# =============================================================================
# AGENT SERVICE TOKEN (Convex ↔ Agent authentication)
# =============================================================================
AGENT_SERVICE_TOKEN=ast_...  # Generate with: openssl rand -hex 32
```

Create `agent/.env` for the Python agent:

```bash
# =============================================================================
# CONVEX CONNECTION
# =============================================================================
CONVEX_URL=https://your-deployment.convex.cloud
AGENT_SERVICE_TOKEN=ast_...  # Same as above

# =============================================================================
# LIVEKIT
# =============================================================================
LIVEKIT_URL=wss://your-app.livekit.cloud
LIVEKIT_API_KEY=API...
LIVEKIT_API_SECRET=secret...

# =============================================================================
# AI SERVICES
# =============================================================================
DEEPGRAM_API_KEY=dg_...
ANTHROPIC_API_KEY=sk-ant-...
CARTESIA_API_KEY=cart_...
SIMLI_API_KEY=simli_...
DID_API_KEY=did_...

# =============================================================================
# AGENT CONFIG
# =============================================================================
LOG_LEVEL=DEBUG
CHECKPOINT_INTERVAL_SECONDS=60
MAX_SESSION_DURATION_MINUTES=30
```

### 3. Convex Environment Variables

Set server-side environment variables in Convex:

```bash
# Set via CLI
npx convex env set LIVEKIT_API_KEY "API..."
npx convex env set LIVEKIT_API_SECRET "secret..."
npx convex env set AGENT_SERVICE_TOKEN "ast_..."
npx convex env set ANTHROPIC_API_KEY "sk-ant-..."  # For M7 scoring

# Or set via Convex Dashboard → Settings → Environment Variables
```

## Running the Development Environment

### Option A: Full Stack (Recommended)

Open 3 terminal windows:

```bash
# Terminal 1: Convex backend
npx convex dev

# Terminal 2: Next.js frontend
pnpm dev

# Terminal 3: Python agent
cd agent
source .venv/bin/activate
python -m agent.main
```

### Option B: Frontend Only (Mock Agent)

For UI development without the voice pipeline:

```bash
# Terminal 1: Convex backend
npx convex dev

# Terminal 2: Next.js frontend with mock mode
NEXT_PUBLIC_MOCK_AGENT=true pnpm dev
```

Mock mode provides:
- Simulated avatar video feed
- Pre-recorded conversation responses
- Synthetic whisper events
- Instant scoring results

## LiveKit Development Setup

### Create a LiveKit Cloud Project

1. Go to https://cloud.livekit.io
2. Create a new project (EU region for GDPR)
3. Copy API Key and Secret to `.env.local`

### Local LiveKit Server (Optional)

For offline development:

```bash
# Using Docker
docker run --rm \
  -p 7880:7880 \
  -p 7881:7881 \
  -p 7882:7882/udp \
  livekit/livekit-server \
  --dev \
  --bind 0.0.0.0

# Update .env.local
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880
```

## Testing

### Unit Tests (Vitest)

```bash
# Run all unit tests
pnpm test

# Run training-specific tests
pnpm test tests/unit/convex/training/
pnpm test tests/unit/components/training/

# Watch mode
pnpm test:watch
```

### Integration Tests (convex-test)

```bash
# Run Convex integration tests
pnpm test tests/integration/training/
```

### E2E Tests (Playwright)

```bash
# Install browsers (first time)
pnpm exec playwright install

# Run E2E tests
pnpm test:e2e tests/e2e/training/

# UI mode (visual debugging)
pnpm exec playwright test --ui
```

### Python Agent Tests

```bash
cd agent
pytest tests/unit/
pytest tests/integration/ --livekit-url ws://localhost:7880
```

## Seeding Test Data

### Create Test Personas & Scenarios

```bash
# Seed personas and scenarios for development
npx convex run training/seed:seedDevelopmentData
```

This creates:
- 2 test personas (Sarah Chen, Marcus Weber)
- 1 test scenario (Discovery Call)
- Test user with all consents granted

### Manual Data Creation

```typescript
// Via Convex Dashboard → Functions → Run

// Create a persona
await api.training.personas.create({
  name: "Test Persona",
  role: "VP of Engineering",
  company: "TechCorp",
  industry: "Technology",
  personality: "analytical",
  communicationStyle: "direct",
  painPoints: ["Legacy systems", "Team scaling"],
  baseDifficulty: 5,
  objectionTypes: ["price", "timing"],
  cartesiaVoiceId: "test-voice-id",
  simlifaceId: "test-face-id",
  language: "en",
});
```

## Troubleshooting

### Common Issues

#### "CONVEX_DEPLOYMENT not set"

```bash
# Run Convex dev to auto-configure
npx convex dev
```

#### "LiveKit connection failed"

1. Check `NEXT_PUBLIC_LIVEKIT_URL` is correct
2. Verify API key/secret match LiveKit dashboard
3. Ensure room tokens are being generated correctly

#### "Agent not joining room"

1. Check agent logs for connection errors
2. Verify `LIVEKIT_API_SECRET` matches Convex env var
3. Ensure room exists before agent tries to join

#### "Deepgram transcription not working"

1. Check `DEEPGRAM_API_KEY` is valid
2. Verify microphone permissions in browser
3. Check audio is being captured (use Web Audio visualizer)

#### "Avatar not rendering"

1. Check Simli API key and face ID
2. If Simli fails, verify D-ID fallback is configured
3. Check browser console for WebRTC errors

### Debug Mode

Enable verbose logging:

```bash
# Frontend
DEBUG=training:* pnpm dev

# Python agent
LOG_LEVEL=DEBUG python -m agent.main

# Convex functions
# Add console.log statements - visible in Convex Dashboard → Logs
```

## Architecture Reference

```
┌─────────────────────────────────────────────────────────────────┐
│  LOCAL DEVELOPMENT                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │ Next.js      │   │ Convex Dev   │   │ Python Agent │        │
│  │ localhost:   │   │ (cloud or    │   │ localhost    │        │
│  │ 3000         │◄─►│ local)       │◄─►│ (connects to │        │
│  │              │   │              │   │ LiveKit)     │        │
│  └──────────────┘   └──────────────┘   └──────────────┘        │
│         │                  │                  │                 │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   EXTERNAL SERVICES                      │   │
│  │  • LiveKit Cloud (or local Docker)                       │   │
│  │  • Deepgram API                                          │   │
│  │  • Anthropic API                                         │   │
│  │  • Cartesia API                                          │   │
│  │  • Simli API / D-ID API                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Next Steps

After completing local setup:

1. **Run the seed script** to create test data
2. **Start a test session** via `/training` page
3. **Verify voice pipeline** by speaking into microphone
4. **Check Convex Dashboard** for real-time data updates
5. **Review agent logs** for whisper triggers and state changes

For implementation details, see:
- [research.md](./research.md) - Integration patterns
- [data-model.md](./data-model.md) - Database schema
- [contracts/](./contracts/) - API contracts
