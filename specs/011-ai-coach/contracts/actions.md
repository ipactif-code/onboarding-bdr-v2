# Action Contracts: AI Coach Module (M7)

**Feature**: 011-ai-coach
**Date**: 2026-01-09

## Overview

Actions handle external API calls to Claude AI. All actions are internal and called by mutations or scheduled functions.

---

## AI Response Actions

### generateResponse

Generates coach response for a user message using Claude API with streaming.

```typescript
// convex/coach/actions.ts

export const generateResponse = internalAction({
  args: {
    conversationId: v.id("coachConversations"),
    userMessageId: v.id("coachMessages"),
  },
  returns: v.object({
    coachMessageId: v.id("coachMessages"),
    tokensUsed: v.object({
      input: v.number(),
      output: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    // 1. Get conversation and validate
    const conversation = await ctx.runQuery(
      internal.coach.queries.getConversation,
      { conversationId: args.conversationId }
    );

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // 2. Get coaching context
    const context = await ctx.runQuery(
      internal.coach.queries.getCoachingContext,
      {
        userId: conversation.userId,
        conversationType: conversation.type,
        sessionId: conversation.sessionId,
      }
    );

    // 3. Get conversation history
    const messages = await ctx.runQuery(
      internal.coach.queries.getConversationMessagesInternal,
      { conversationId: args.conversationId }
    );

    // 4. Build system prompt
    const systemPrompt = buildSystemPrompt({
      bdrName: context.bdrName,
      language: conversation.language,
      certificationLevel: context.certificationLevel,
      conversationType: conversation.type,
      averageScore: context.averageScore,
      strengths: context.strengths,
      weaknesses: context.weaknesses,
      sessionDetails: context.sessionDetails,
      weeklyStats: context.weeklyStats,
    });

    // 5. Build message history for Claude
    const claudeMessages = messages.map((m) => ({
      role: m.sender === "coach" ? "assistant" : "user",
      content: m.content,
    }));

    // 6. Call Claude API
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 500,
      temperature: 0.5,
      system: systemPrompt,
      messages: claudeMessages,
    });

    const responseContent = response.content[0];
    if (responseContent.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // 7. Extract transcript references (for debrief)
    let transcriptRefs;
    if (conversation.type === "debrief" && context.sessionDetails) {
      transcriptRefs = extractTranscriptReferences(
        responseContent.text,
        context.sessionDetails.transcript
      );
    }

    // 8. Store coach message
    const coachMessageId = await ctx.runMutation(
      internal.coach.mutations.storeCoachMessage,
      {
        conversationId: args.conversationId,
        content: responseContent.text,
        transcriptRefs,
      }
    );

    return {
      coachMessageId,
      tokensUsed: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    };
  },
});
```

---

### generatePlanContent

Generates a personalized training plan using Claude API.

```typescript
export const generatePlanContent = internalAction({
  args: {
    planId: v.id("trainingPlans"),
    conversationId: v.id("coachConversations"),
  },
  returns: v.object({
    success: v.boolean(),
    tokensUsed: v.object({
      input: v.number(),
      output: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    // 1. Get plan and user info
    const plan = await ctx.runQuery(internal.coach.queries.getPlanInternal, {
      planId: args.planId,
    });

    if (!plan) {
      throw new Error("Plan not found");
    }

    // 2. Get session history and scores
    const sessions = await ctx.runQuery(
      internal.coach.queries.getSessionsForAnalysis,
      { sessionIds: plan.analyzedSessions }
    );

    // 3. Build analysis prompt
    const analysisPrompt = buildPlanAnalysisPrompt({
      sessions,
      language: plan.language,
    });

    // 4. Call Claude API (longer timeout for analysis)
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 2000,
      temperature: 0.3, // Lower for more consistent analysis
      system: PLAN_GENERATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: analysisPrompt }],
    });

    const responseContent = response.content[0];
    if (responseContent.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // 5. Parse structured plan from response
    const planData = parsePlanResponse(responseContent.text);

    // 6. Update plan with generated content
    await ctx.runMutation(internal.coach.mutations.populatePlanContent, {
      planId: args.planId,
      skillGaps: planData.skillGaps,
      weeks: planData.weeks.map((w) => ({
        ...w,
        status: "pending" as const,
        scenarios: w.scenarios.map((s) => ({
          ...s,
          completed: false,
        })),
      })),
    });

    // 7. Send intro message to conversation
    const introMessage = buildPlanIntroMessage(planData, plan.language);
    await ctx.runMutation(internal.coach.mutations.storeCoachMessage, {
      conversationId: args.conversationId,
      content: introMessage,
    });

    return {
      success: true,
      tokensUsed: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    };
  },
});
```

---

### generateWeeklyCheckinMessage

Generates the weekly check-in summary message.

```typescript
export const generateWeeklyCheckinMessage = internalAction({
  args: {
    checkinId: v.id("weeklyCheckins"),
    conversationId: v.id("coachConversations"),
  },
  returns: v.object({
    coachMessageId: v.id("coachMessages"),
    tokensUsed: v.object({
      input: v.number(),
      output: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    // 1. Get check-in data
    const checkin = await ctx.runQuery(
      internal.coach.queries.getCheckinInternal,
      { checkinId: args.checkinId }
    );

    if (!checkin) {
      throw new Error("Check-in not found");
    }

    // 2. Get user info
    const user = await ctx.runQuery(internal.users.get, {
      userId: checkin.userId,
    });

    // 3. Build check-in prompt
    const prompt = buildWeeklyCheckinPrompt({
      bdrName: user.name,
      language: user.preferredLang ?? "en",
      sessionCount: checkin.sessionCount,
      averageScore: checkin.averageScore,
      comparison: checkin.comparison,
      planProgress: checkin.planProgress,
    });

    // 4. Call Claude API
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 400,
      temperature: 0.5,
      system: WEEKLY_CHECKIN_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const responseContent = response.content[0];
    if (responseContent.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // 5. Store message
    const coachMessageId = await ctx.runMutation(
      internal.coach.mutations.storeCoachMessage,
      {
        conversationId: args.conversationId,
        content: responseContent.text,
      }
    );

    // 6. Link conversation to check-in
    await ctx.runMutation(internal.coach.mutations.linkCheckinConversation, {
      checkinId: args.checkinId,
      conversationId: args.conversationId,
    });

    return {
      coachMessageId,
      tokensUsed: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    };
  },
});
```

---

## Helper Functions

### buildSystemPrompt

Builds the system prompt for the AI coach.

```typescript
function buildSystemPrompt(params: {
  bdrName: string;
  language: string;
  certificationLevel: string;
  conversationType: string;
  averageScore: number;
  strengths: string[];
  weaknesses: string[];
  sessionDetails?: { /* ... */ };
  weeklyStats?: { /* ... */ };
}): string {
  // Base persona
  let prompt = COACH_PERSONA[params.language] || COACH_PERSONA.en;

  // Add context based on conversation type
  switch (params.conversationType) {
    case "debrief":
      prompt += `\n\nCONTEXTE DE LA SESSION:\n`;
      prompt += `Score: ${params.sessionDetails?.score}/100\n`;
      prompt += `Points forts: ${params.sessionDetails?.feedback.strengths.join(", ")}\n`;
      prompt += `Points à améliorer: ${params.sessionDetails?.feedback.improvements.join(", ")}\n`;
      prompt += `\nMOMENTS CLÉS DU TRANSCRIPT:\n`;
      params.sessionDetails?.keyMoments.forEach((m) => {
        prompt += `- [${m.type}] "${m.text}" - ${m.analysis}\n`;
      });
      break;

    case "weekly_checkin":
      prompt += `\n\nSTATISTIQUES DE LA SEMAINE:\n`;
      prompt += `Sessions: ${params.weeklyStats?.sessionCount}\n`;
      prompt += `Score moyen: ${params.weeklyStats?.averageScore}\n`;
      prompt += `Évolution: ${params.weeklyStats?.previousWeekScore} → ${params.weeklyStats?.averageScore}\n`;
      break;

    case "ask_coach":
      prompt += `\n\nCONTEXTE BDR:\n`;
      prompt += `Niveau: ${params.certificationLevel}\n`;
      prompt += `Score moyen: ${params.averageScore}\n`;
      prompt += `Forces: ${params.strengths.join(", ")}\n`;
      prompt += `Axes d'amélioration: ${params.weaknesses.join(", ")}\n`;
      break;
  }

  // Language instruction
  prompt += `\n\nRÈGLE ABSOLUE: Réponds UNIQUEMENT en ${getLanguageName(params.language)}.`;

  return prompt;
}
```

---

### extractTranscriptReferences

Extracts transcript excerpts referenced in coach response.

```typescript
function extractTranscriptReferences(
  coachResponse: string,
  transcript: string
): Array<{ start: number; end: number; text: string }> {
  const refs: Array<{ start: number; end: number; text: string }> = [];

  // Pattern: Look for quoted text in coach response that matches transcript
  const quotePattern = /[«"'](.*?)[»"']/g;
  let match;

  while ((match = quotePattern.exec(coachResponse)) !== null) {
    const quotedText = match[1];
    if (quotedText.length > 10) {
      // Only meaningful quotes
      const startIndex = transcript.indexOf(quotedText);
      if (startIndex !== -1) {
        refs.push({
          start: startIndex,
          end: startIndex + quotedText.length,
          text: quotedText,
        });
      }
    }
  }

  return refs.slice(0, 5); // Max 5 references per response
}
```

---

### parsePlanResponse

Parses structured plan from Claude response.

```typescript
interface ParsedPlan {
  skillGaps: Array<{
    dimension: string;
    score: number;
    priority: number;
  }>;
  weeks: Array<{
    weekNumber: number;
    focus: string;
    targetDimension: string;
    scenarios: Array<{
      scenarioId: string;
      personaId: string;
      targetScore: number;
    }>;
    weeklyGoal: string;
  }>;
}

function parsePlanResponse(response: string): ParsedPlan {
  // Claude is instructed to return JSON in a specific format
  // Extract JSON from response
  const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    throw new Error("Invalid plan response format");
  }

  const parsed = JSON.parse(jsonMatch[1]);

  // Validate structure
  if (
    !Array.isArray(parsed.skillGaps) ||
    parsed.skillGaps.length !== 3 ||
    !Array.isArray(parsed.weeks) ||
    parsed.weeks.length < 2 ||
    parsed.weeks.length > 4
  ) {
    throw new Error("Invalid plan structure");
  }

  return parsed;
}
```

---

## System Prompts

### COACH_PERSONA

```typescript
const COACH_PERSONA: Record<string, string> = {
  fr: `Tu es Alex, un coach de vente senior chez DiliTrust.

PERSONNALITÉ:
- Ton: Encourageant mais direct, comme un mentor expérimenté
- Style: Tu poses des questions pour guider la réflexion, tu ne fais pas la leçon
- Approche: Toujours spécifique (cite des moments précis), jamais générique

RÈGLES:
1. Commence toujours par quelque chose de positif
2. Sois spécifique (cite des moments, des chiffres)
3. Limite-toi à 2-3 points d'amélioration max par échange
4. Pose des questions pour engager la réflexion
5. Termine par une action concrète`,

  en: `You are Alex, a senior sales coach at DiliTrust.

PERSONALITY:
- Tone: Encouraging but direct, like an experienced mentor
- Style: Ask questions to guide reflection, don't lecture
- Approach: Always specific (cite precise moments), never generic

RULES:
1. Always start with something positive
2. Be specific (cite moments, numbers)
3. Limit to 2-3 improvement points max per exchange
4. Ask questions to engage reflection
5. End with a concrete action`,

  // ... similar for it, es, de
};
```

---

### PLAN_GENERATION_SYSTEM_PROMPT

```typescript
const PLAN_GENERATION_SYSTEM_PROMPT = `You are a sales training analyst creating personalized training plans.

OUTPUT FORMAT:
Return ONLY valid JSON in this exact format:
\`\`\`json
{
  "skillGaps": [
    { "dimension": "spinScore", "score": 65, "priority": 1 },
    { "dimension": "raccScore", "score": 68, "priority": 2 },
    { "dimension": "behavioralScore", "score": 70, "priority": 3 }
  ],
  "weeks": [
    {
      "weekNumber": 1,
      "focus": "SPIN Questioning Mastery",
      "targetDimension": "spinScore",
      "scenarios": [
        { "scenarioId": "discovery_call", "personaId": "enthusiastic_champion", "targetScore": 70 },
        { "scenarioId": "demo_followup", "personaId": "technical_detailist", "targetScore": 70 }
      ],
      "weeklyGoal": "Complete 3 sessions focusing on open-ended SPIN questions"
    }
    // ... more weeks
  ]
}
\`\`\`

CONSTRAINTS:
- Exactly 3 skill gaps, ordered by priority
- 2-4 weeks in plan
- 2-3 scenarios per week
- Target scores should be achievable (current score + 5-10 points)
- Use only valid scenario and persona IDs from the context provided`;
```

---

### WEEKLY_CHECKIN_SYSTEM_PROMPT

```typescript
const WEEKLY_CHECKIN_SYSTEM_PROMPT = `You are Alex, delivering a weekly progress check-in.

STRUCTURE:
1. Warm greeting with the BDR's name
2. Week summary (sessions, score, trend)
3. One specific highlight from the week
4. Brief encouragement or focus for next week
5. Quick closing question to engage

CONSTRAINTS:
- Keep under 150 words
- Be specific with numbers
- Match enthusiasm to performance trend
- If plan progress provided, reference it
- End with ONE actionable focus`;
```

---

## Error Handling

All actions implement consistent error handling:

```typescript
try {
  // Action logic
} catch (error) {
  if (error instanceof Anthropic.APIError) {
    // Log API error
    console.error("Claude API error:", error.status, error.message);

    if (error.status === 429) {
      // Rate limited - retry with backoff
      throw new Error("AI service temporarily unavailable. Please retry.");
    }

    if (error.status >= 500) {
      // Server error - retry
      throw new Error("AI service error. Please retry.");
    }
  }

  // Log and rethrow
  console.error("Action error:", error);
  throw error;
}
```
