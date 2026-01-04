# Research: AI Sales Trainer

**Feature**: AI Sales Trainer | **Date**: 2026-01-03 | **Phase**: 0

## Executive Summary

This research document covers integration patterns and best practices for the AI Sales Trainer's real-time voice pipeline. The system requires sub-1000ms end-to-end latency for natural conversation flow, combining LiveKit Agents (Python), Deepgram STT, Claude LLM, Cartesia TTS, and Simli avatar with D-ID fallback.

All technologies have been validated via Context7 official documentation (Source Reputation: High). No NEEDS CLARIFICATION markers remain.

---

## 1. LiveKit Agents Framework

### Overview

LiveKit Agents is the orchestration framework for real-time voice AI. It provides the STT-LLM-TTS pipeline architecture with built-in VAD (Voice Activity Detection) and turn detection.

**Context7 Library ID**: `/websites/livekit_io_agents` (Source Reputation: High, Score: 87.6)

### Core Architecture Pattern

```python
from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io
from livekit.plugins import noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

class Assistant(Agent):
    def __init__(self, chat_ctx: ChatContext) -> None:
        super().__init__(
            instructions="""Your persona and instructions here...""",
            chat_ctx=chat_ctx,
        )

server = AgentServer()

@server.rtc_session()
async def my_agent(ctx: agents.JobContext):
    # Load metadata from token (userId, sessionId, personaId)
    metadata = json.loads(ctx.job.metadata)

    session = AgentSession(
        stt="deepgram/nova-2:en",      # Deepgram Nova-2
        llm=anthropic.LLM(model="claude-3-5-haiku-20241022"),  # Claude Haiku
        tts="cartesia/sonic-2:voice_id",  # Cartesia Sonic
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )

    await session.start(
        room=ctx.room,
        agent=Assistant(chat_ctx=initial_ctx),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=noise_cancellation.BVC(),
            ),
        ),
    )
```

### Token-Based Authentication

LiveKit uses JWT tokens with embedded metadata for agent dispatch:

```python
from livekit.api import AccessToken, RoomAgentDispatch, RoomConfiguration, VideoGrants

def create_session_token(user_id: str, session_id: str, persona_id: str) -> str:
    token = (
        AccessToken()
        .with_identity(f"user_{user_id}")
        .with_grants(VideoGrants(room_join=True, room=f"session_{session_id}"))
        .with_room_config(
            RoomConfiguration(
                agents=[
                    RoomAgentDispatch(
                        agent_name="sales-trainer",
                        metadata=json.dumps({
                            "user_id": user_id,
                            "session_id": session_id,
                            "persona_id": persona_id,
                        })
                    )
                ],
            ),
        )
        .to_jwt()
    )
    return token
```

### Function Tools for Intelligence Modules

The agent framework supports custom tools for implementing M1-M4 and M6 modules:

```python
from livekit.agents import function_tool, RunContext

class SalesTrainerAgent(Agent):
    @function_tool()
    async def trigger_whisper(
        self,
        context: RunContext,
        whisper_type: str,
        message: str,
    ) -> dict:
        """Trigger a coaching whisper to the BDR.

        Args:
            whisper_type: Type of whisper (technique_suggestion, warning, encouragement)
            message: The whisper message content
        """
        # Send to Convex for real-time subscription
        await self.convex_client.mutation(
            "training/coaching:createWhisper",
            {
                "sessionId": self.session_id,
                "type": whisper_type,
                "message": message,
            }
        )
        return {"status": "whisper_sent"}
```

### Key Considerations

1. **Pre-warming**: Establish connections to Anthropic, Cartesia, Simli at session start
2. **Context window**: Limit conversation history to 10 turns to maintain latency
3. **Checkpoint recovery**: Save state to Convex every 60 seconds for crash recovery
4. **Streaming**: Use streaming output from Claude (don't wait for complete response)

---

## 2. Deepgram Speech-to-Text (STT)

### Overview

Deepgram provides real-time streaming STT with Nova-2/Nova-3 models. Supports interim results for responsive turn detection.

**Context7 Library ID**: `/websites/developers_deepgram` (Source Reputation: High, Score: 78.3)

### LiveKit Integration Pattern

```python
from livekit.plugins import deepgram

session = AgentSession(
    stt=deepgram.STT(
        model="nova-2",
        language="en-US",
    ),
    # Or via plugin directly:
    stt=deepgram.STTv2(
        model="flux-general-en",
        eager_eot_threshold=0.4,  # End-of-turn threshold
    ),
)
```

### Streaming Configuration for Low Latency

```python
from deepgram import LiveOptions

options = LiveOptions(
    model="nova-3",
    language="en-US",
    smart_format=True,
    encoding="linear16",
    channels=1,
    sample_rate=16000,
    # Critical for real-time:
    interim_results=True,      # Get preliminary transcriptions
    utterance_end_ms="1000",   # End of utterance detection
    vad_events=True,           # Voice activity detection events
    endpointing=300,           # Silence before finalizing (ms)
)
```

### Multi-Language Support

For the 5 supported languages (EN, FR, ES, DE, IT):

| Language | Deepgram Code | Model |
|----------|---------------|-------|
| English | `en-US` | nova-2 |
| French | `fr` | nova-2 |
| Spanish | `es` | nova-2 |
| German | `de` | nova-2 |
| Italian | `it` | nova-2 |

### Key Considerations

1. **EU Region**: Use Deepgram EU endpoint for GDPR compliance
2. **Interim results**: Essential for responsive turn detection
3. **VAD events**: Enable `START_OF_SPEECH` and `END_OF_SPEECH` events
4. **Endpointing**: 300ms provides good balance between responsiveness and accuracy

---

## 3. Anthropic Claude LLM

### Overview

Claude 3.5 Haiku for real-time conversation (latency-optimized), Claude 3.5 Sonnet for scoring and coaching (quality-optimized).

**Context7 Library ID**: `/websites/livekit_io_agents` (via Anthropic plugin)

### LiveKit Integration Pattern

```python
from livekit.plugins import anthropic

session = AgentSession(
    llm=anthropic.LLM(
        model="claude-3-5-haiku-20241022",  # Fast for conversation
        temperature=0.8,  # Slight creativity for natural responses
    ),
)

# For scoring (separate call, not in pipeline):
scoring_llm = anthropic.LLM(
    model="claude-3-5-sonnet-20241022",  # Quality for evaluation
    temperature=0.3,  # More deterministic for scoring
)
```

### Persona System Prompt Structure

```python
PERSONA_PROMPT_TEMPLATE = """
You are {persona_name}, a {persona_role} at {company_name}.

## Character Traits
- Personality: {personality_description}
- Communication style: {communication_style}
- Pain points: {pain_points}

## Current Scenario
{scenario_description}

## Difficulty Level: {difficulty}/5
- At level 1-2: Be receptive, ask clarifying questions
- At level 3: Raise standard objections
- At level 4-5: Be skeptical, require strong value proposition

## Conversation Rules
1. Stay in character at all times
2. Respond naturally as a human prospect would
3. Do not reveal you are an AI
4. Base responses on the BDR's actual statements
"""
```

### Streaming for Low Latency

LiveKit's Anthropic plugin handles streaming automatically. Key settings:

```python
# The plugin streams by default
# Ensure max_tokens is reasonable to avoid long waits
llm=anthropic.LLM(
    model="claude-3-5-haiku-20241022",
    max_tokens=150,  # Keep responses concise for voice
)
```

### Key Considerations

1. **Model selection**: Haiku for conversation, Sonnet for scoring
2. **Streaming**: Essential for <800ms P50 latency
3. **Context management**: Limit to 10 turns in conversation window
4. **Temperature**: 0.7-0.8 for natural conversation, 0.2-0.3 for scoring

---

## 4. Cartesia Text-to-Speech (TTS)

### Overview

Cartesia provides ultra-low-latency TTS with streaming output. Supports word-level timestamps for lip sync coordination.

**Context7 Library ID**: `/cartesia-ai/cartesia-python` (Source Reputation: High, Score: 79)

### LiveKit Integration Pattern

```python
# Via LiveKit string descriptor
session = AgentSession(
    tts="cartesia/sonic-2:voice_id_here",
)

# Or via plugin for more control
from livekit.plugins import cartesia

session = AgentSession(
    tts=cartesia.TTS(
        model="sonic-2",
        voice_id="a0e99841-438c-4a64-b679-ae501e7d6091",
    ),
)
```

### Streaming WebSocket Pattern (for direct integration)

```python
from cartesia import AsyncCartesia

async def stream_tts(text: str, voice_id: str):
    client = AsyncCartesia(api_key=os.getenv("CARTESIA_API_KEY"))
    ws = await client.tts.websocket()

    output = await ws.send(
        model_id="sonic-2",
        transcript=text,
        voice={"id": voice_id},
        output_format={
            "container": "raw",
            "encoding": "pcm_f32le",
            "sample_rate": 22050,
        },
        add_timestamps=True,  # For lip sync
        stream=True,
    )

    async for chunk in output:
        if chunk.audio:
            yield chunk.audio
        if chunk.word_timestamps:
            # Send to avatar for lip sync
            pass

    await ws.close()
    await client.close()
```

### Voice Selection for Personas

Map personas to appropriate voices based on:
- Gender
- Age range
- Accent/regionality
- Energy level

```python
PERSONA_VOICES = {
    "alex_tech_cto": "voice_id_professional_male",
    "sarah_hr_director": "voice_id_warm_female",
    "marcus_skeptical_cfo": "voice_id_authoritative_male",
    # ... 8 personas total
}
```

### Key Considerations

1. **Sample rate**: 22050 Hz for quality, 16000 Hz for bandwidth
2. **Timestamps**: Enable for avatar lip sync coordination
3. **Voice cloning**: Cartesia supports custom voices if needed
4. **Multi-language**: Supports all 5 target languages

---

## 5. Simli Avatar (Primary)

### Overview

Simli provides real-time AI avatar rendering with audio-driven lip sync. Uses WebRTC for low-latency video streaming.

**Context7 Library ID**: `/websites/simli` (Source Reputation: High, Score: 55)

### Integration Pattern

```javascript
// Frontend: Initialize Simli WebRTC connection
const simliClient = new SimliClient();

// Start session with face ID
const metadata = {
  faceId: "persona_face_id",
  apiKey: process.env.SIMLI_API_KEY,
  syncAudio: true,
};

const response = await fetch("https://api.simli.ai/startAudioToVideoSession", {
  method: "POST",
  body: JSON.stringify(metadata),
  headers: { "Content-Type": "application/json" },
});

const { session_token } = await response.json();
wsConnection.send(session_token);
```

### Pipecat Integration (Alternative to direct WebRTC)

```python
from simli import SimliConfig
from pipecat.services.simli.video import SimliVideoService

simli_ai = SimliVideoService(
    SimliConfig(
        api_key=os.getenv("SIMLI_API_KEY"),
        face_id=os.getenv("SIMLI_FACE_ID"),
    ),
)

# In pipeline
pipeline = Pipeline([
    stt,
    llm,
    tts,
    simli_ai,  # Video rendering
    transport.output(),
])
```

### Face ID Management

Each persona requires a pre-configured Simli face:

```python
PERSONA_FACES = {
    "alex_tech_cto": "simli_face_alex",
    "sarah_hr_director": "simli_face_sarah",
    # ... 8 personas
}
```

### Key Considerations

1. **Pre-warming**: Start session before first audio to reduce cold start
2. **Audio sync**: Ensure TTS timestamps align with avatar lip sync
3. **Bandwidth**: Avatar video adds ~500kbps-1Mbps per session
4. **Face IDs**: Pre-generate faces for all 8 personas

---

## 6. D-ID Avatar (Fallback)

### Overview

D-ID provides talking head video generation via WebRTC streaming. Used as fallback when Simli circuit breaker trips.

**Context7 Library ID**: `/websites/d-id` (Source Reputation: High)

### WebRTC Streaming Pattern

```javascript
// Initialize peer connection
const sessionResponse = await fetch(`${DID_API.url}/talks/streams`, {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${DID_API.key}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    source_url: avatarImageUrl,  // Pre-uploaded persona image
  }),
});

const { id: streamId, offer, ice_servers, session_id } = await sessionResponse.json();

// Create WebRTC peer connection with ICE servers
const pc = new RTCPeerConnection({ iceServers: ice_servers });

// Handle incoming video track
pc.addEventListener('track', (evt) => {
  if (evt.track.kind === 'video') {
    videoElement.srcObject = evt.streams[0];
  }
});

// Send audio to drive the avatar
await fetch(`${DID_API.url}/talks/streams/${streamId}`, {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${DID_API.key}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    script: {
      type: 'audio',
      audio_url: audioUrl,  // URL to TTS audio
    },
    session_id: sessionId,
  }),
});
```

### Circuit Breaker Implementation

```python
class AvatarCircuitBreaker:
    def __init__(self, failure_threshold: int = 3, reset_timeout: int = 30):
        self.failures = 0
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.last_failure_time = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN

    async def call(self, primary_fn, fallback_fn, *args, **kwargs):
        if self.state == "OPEN":
            if time.time() - self.last_failure_time > self.reset_timeout:
                self.state = "HALF_OPEN"
            else:
                return await fallback_fn(*args, **kwargs)

        try:
            result = await primary_fn(*args, **kwargs)
            if self.state == "HALF_OPEN":
                self.state = "CLOSED"
                self.failures = 0
            return result
        except Exception as e:
            self.failures += 1
            self.last_failure_time = time.time()
            if self.failures >= self.failure_threshold:
                self.state = "OPEN"
            return await fallback_fn(*args, **kwargs)
```

### Key Considerations

1. **Warm standby**: Keep D-ID connection warm in background
2. **Image assets**: Pre-upload persona images to D-ID
3. **Latency**: D-ID typically 100-200ms slower than Simli
4. **Cost**: D-ID charged per minute of generated video

---

## 7. Convex Backend Integration

### Overview

Convex provides real-time subscriptions for whispers, session state, and scores. Agent communicates via HTTP actions.

**Context7 Library ID**: `/get-convex/convex-js` (Source Reputation: High, Score: 93.1)

### Agent-to-Convex HTTP Client

```python
from convex import ConvexClient

class ConvexAgentClient:
    def __init__(self, url: str, service_token: str):
        self.url = url
        self.token = service_token

    async def mutation(self, function_name: str, args: dict):
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.url}/api/mutation",
                json={"path": function_name, "args": args},
                headers={"Authorization": f"Bearer {self.token}"},
            ) as response:
                return await response.json()

    async def query(self, function_name: str, args: dict):
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.url}/api/query",
                json={"path": function_name, "args": args},
                headers={"Authorization": f"Bearer {self.token}"},
            ) as response:
                return await response.json()
```

### HTTP Action for Agent Bridge

```typescript
// convex/training/internal/agentBridge.ts
import { httpAction } from "../_generated/server";
import { api } from "../_generated/api";

export const updateSessionState = httpAction(async (ctx, request) => {
  // Verify agent service token
  const authHeader = request.headers.get("Authorization");
  if (!verifyAgentToken(authHeader)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { sessionId, state, checkpoint } = await request.json();

  await ctx.runMutation(api.training.sessions.updateState, {
    sessionId,
    state,
    checkpoint,
  });

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

### Real-Time Whisper Subscription (Frontend)

```typescript
// Frontend hook for whisper notifications
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useWhispers(sessionId: Id<"trainingSessions">) {
  const whispers = useQuery(api.training.coaching.getActiveWhispers, {
    sessionId,
  });

  return whispers ?? [];
}
```

### Key Considerations

1. **Service token**: Agent uses dedicated service token, not user JWT
2. **Checkpoints**: Store session state every 60 seconds
3. **Real-time**: Frontend subscribes to whispers via Convex queries
4. **Audio storage**: Use Convex `_storage` for recordings

---

## 8. Intelligence Module Architecture

### M1: Adaptive Difficulty Engine

Location: Agent (Python)

```python
class DifficultyEngine:
    def __init__(self):
        self.current_level = 3  # Start at medium
        self.adjustment_threshold = 0.3

    def adjust(self, performance_signals: dict) -> int:
        """
        Signals: objection_handling_success, rapport_score,
                 technique_usage, response_quality
        """
        avg_score = sum(performance_signals.values()) / len(performance_signals)

        if avg_score > 0.8 and self.current_level < 5:
            self.current_level += 1
        elif avg_score < 0.4 and self.current_level > 1:
            self.current_level -= 1

        return self.current_level
```

### M2: Coaching Whispers

Location: Agent → Convex → Frontend

```python
# Agent detects trigger
WHISPER_TRIGGERS = {
    "missed_discovery_question": "Try asking about their current process",
    "weak_value_prop": "Focus on ROI metrics for this persona",
    "objection_fumble": "Use the feel-felt-found technique",
}

async def check_whisper_triggers(self, transcript: str, context: dict):
    for trigger, suggestion in WHISPER_TRIGGERS.items():
        if self.detect_trigger(trigger, transcript, context):
            await self.trigger_whisper("technique_suggestion", suggestion)
```

### M3: Emotional State Machine

Location: Agent (Python)

```python
from enum import Enum

class EmotionalState(Enum):
    NEUTRAL = "neutral"
    INTERESTED = "interested"
    SKEPTICAL = "skeptical"
    FRUSTRATED = "frustrated"
    ENGAGED = "engaged"

class EmotionalStateMachine:
    transitions = {
        (EmotionalState.NEUTRAL, "good_pitch"): EmotionalState.INTERESTED,
        (EmotionalState.INTERESTED, "weak_response"): EmotionalState.SKEPTICAL,
        (EmotionalState.SKEPTICAL, "strong_evidence"): EmotionalState.ENGAGED,
        (EmotionalState.ENGAGED, "pushy_close"): EmotionalState.FRUSTRATED,
    }

    def transition(self, event: str) -> EmotionalState:
        key = (self.current_state, event)
        if key in self.transitions:
            self.current_state = self.transitions[key]
        return self.current_state
```

### M4: Scenario Branching

Location: Agent (Python)

```python
class BranchDetector:
    CRITICAL_MOMENTS = [
        "pricing_discussion",
        "competitor_mention",
        "objection_raised",
        "decision_maker_reference",
    ]

    async def detect_branch_point(self, transcript: str) -> Optional[str]:
        for moment in self.CRITICAL_MOMENTS:
            if self.classify_moment(transcript, moment):
                # Record branch for What-If replay
                await self.record_branch_point(moment, transcript)
                return moment
        return None
```

### M6: Voice Sentiment Analysis

Location: Frontend (Web Audio API) + Agent (aggregation)

```typescript
// Frontend: Extract voice features
class VoiceAnalyzer {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;

  extractFeatures(): VoiceFeatures {
    const dataArray = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatTimeDomainData(dataArray);

    return {
      pitch: this.calculatePitch(dataArray),
      energy: this.calculateEnergy(dataArray),
      speechRate: this.calculateSpeechRate(),
      pausePattern: this.detectPauses(),
    };
  }
}
```

### M7: AI Coaching (Weekly Cron)

Location: Convex Cron

```typescript
// convex/crons/training.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.weekly(
  "generate-coaching-plans",
  { dayOfWeek: "monday", hourUTC: 6, minuteUTC: 0 },
  internal.training.coaching.generateWeeklyPlans
);

export default crons;
```

---

## 9. Latency Optimization Strategies

### Target: P50 < 800ms, P95 < 1000ms, P99 < 1200ms

| Component | Target Latency | Strategy |
|-----------|----------------|----------|
| STT (Deepgram) | 100-200ms | Streaming with interim results |
| LLM (Claude) | 300-500ms | Streaming output, Haiku model |
| TTS (Cartesia) | 100-200ms | WebSocket streaming |
| Avatar | 100-200ms | Pre-warmed connection |
| Network | 50-100ms | EU regional deployment |

### Pre-Warming Protocol

```python
async def prewarm_connections(self):
    """Called at session start before first user audio"""
    await asyncio.gather(
        self.anthropic_client.connect(),
        self.cartesia_client.connect(),
        self.simli_client.connect(),
        self.convex_client.connect(),
    )
```

### Conversation Context Pruning

```python
def prune_context(self, messages: list, max_turns: int = 10):
    """Keep only recent turns to maintain latency"""
    if len(messages) > max_turns * 2:
        # Keep system prompt + last N turns
        return messages[:1] + messages[-(max_turns * 2):]
    return messages
```

### Degradation Notification

```python
class LatencyMonitor:
    def __init__(self, threshold_ms: int = 1000):
        self.threshold = threshold_ms
        self.recent_latencies = deque(maxlen=10)

    async def record_and_check(self, latency_ms: int) -> bool:
        self.recent_latencies.append(latency_ms)
        avg = sum(self.recent_latencies) / len(self.recent_latencies)

        if avg > self.threshold:
            await self.notify_degradation(avg)
            return True
        return False
```

---

## 10. Security & GDPR Patterns

### Agent Service Authentication

```python
# Agent authenticates via service token (not user JWT)
AGENT_SERVICE_TOKEN = os.getenv("CONVEX_SERVICE_TOKEN")

# Convex validates token in HTTP action
def verify_agent_token(auth_header: str) -> bool:
    if not auth_header or not auth_header.startswith("Bearer "):
        return False
    token = auth_header.split(" ")[1]
    return hmac.compare_digest(token, EXPECTED_SERVICE_TOKEN)
```

### Consent Enforcement

```typescript
// convex/training/sessions.ts
export const startSession = mutation({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    // Check consent before allowing session
    const consent = await ctx.db
      .query("trainingConsents")
      .withIndex("by_user", (q) => q.eq("userId", identity.userId))
      .first();

    if (!consent || !consent.voiceRecording) {
      throw new ConvexError("Voice recording consent required");
    }

    if (args.mode === "evaluation" && !consent.transcriptStorage) {
      throw new ConvexError("Transcript storage consent required for evaluations");
    }

    // Proceed with session creation...
  },
});
```

### Audio Encryption at Rest

```typescript
// Convex file storage with encryption metadata
export const storeRecording = mutation({
  args: { storageId: v.id("_storage"), sessionId: v.id("trainingSessions") },
  handler: async (ctx, args) => {
    await ctx.db.insert("trainingRecordings", {
      sessionId: args.sessionId,
      storageId: args.storageId,
      encryptionMethod: "AES-256-GCM",  // Documented for compliance
      createdAt: Date.now(),
      expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,  // 90 days
    });
  },
});
```

---

## 11. Validated Context7 Library IDs

| Technology | Library ID | Reputation | Score |
|------------|-----------|------------|-------|
| LiveKit Agents | `/websites/livekit_io_agents` | High | 87.6 |
| Deepgram API | `/websites/developers_deepgram` | High | 78.3 |
| Cartesia Python | `/cartesia-ai/cartesia-python` | High | 79.0 |
| Simli | `/websites/simli` | High | 55.0 |
| D-ID | `/websites/d-id` | High | N/A |
| Convex JS | `/get-convex/convex-js` | High | 93.1 |

---

## 12. Open Questions Resolved

| Question | Resolution |
|----------|------------|
| Encryption standard | AES-256 at rest + TLS 1.3 in transit (user choice) |
| Concurrent persona limits | No limit - scale infrastructure (user choice) |
| Latency degradation handling | Notify user, allow continue/exit (user choice) |
| Agent-Convex auth | Service token via HTTP actions |
| Avatar fallback | Circuit breaker (3 failures → D-ID) |
| Checkpoint frequency | 60 seconds (balance recovery vs. overhead) |

---

## Next Steps

1. **Phase 1**: Generate `data-model.md` with Convex schema definitions
2. **Phase 1**: Generate `contracts/` with API function signatures
3. **Phase 1**: Generate `quickstart.md` for local development setup
