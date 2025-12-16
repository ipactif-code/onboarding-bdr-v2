# Multi-Project Workflow

## Standard Flow

```
┌────────────────────────────────────────────────────────────────────┐
│ 1. USER REQUEST                                                    │
│    → Describe what you need (feature, bug fix, optimization)       │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│ 2. CHIEF ARCHITECT                                                 │
│    → Analyzes request                                              │
│    → Identifies which projects to involve                          │
│    → Creates routing plan with specific questions per project      │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│ 3. SPECIALIZED PROJECTS                                            │
│    → Each project analyzes its domain                              │
│    → May request code/console/HTML from user                       │
│    → Provides recommendations with confidence levels               │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│ 4. CHIEF ARCHITECT                                                 │
│    → Consolidates all outputs                                      │
│    → Resolves conflicts                                            │
│    → Produces final Claude Code instructions                       │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│ 5. CLAUDE CODE                                                     │
│    → Implements instructions                                       │
│    → Runs verification steps                                       │
│    → Commits and pushes                                            │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│ 6. USER VALIDATION                                                 │
│    → Tests implementation                                          │
│    → Refreshes GitHub in all projects                              │
│    → Reports issues or approves                                    │
└────────────────────────────────────────────────────────────────────┘
```

## Routing Guide

| Request Type | Primary Project | Supporting Projects |
|--------------|-----------------|---------------------|
| New feature | Chief Architect → Back-end → Front-end | Design System, Security |
| Bug fix | Chief Architect → Most relevant 1-2 | — |
| Performance issue | Architecture | Back-end, Front-end |
| Security concern | Security (IMMEDIATE) | Back-end |
| UI component needed | Design System | Front-end |
| AI feature | IA & Automatisation | Back-end, Front-end |

## Requesting Information

Projects may ask you for:

| Type | Example Command |
|------|-----------------|
| File content | `cat src/components/X.tsx` |
| Folder structure | `ls -la src/components/` |
| Console errors | Open DevTools → Console → Share errors |
| HTML inspection | Right-click element → Inspect → Share HTML |
| Build output | `npm run build` |
| Convex data | Check Convex dashboard |

## Conflict Resolution

When projects disagree:

1. Chief Architect documents both positions
2. Evaluates against project constitution
3. Prioritizes long-term maintainability
4. Makes decision and documents in DECISIONS.md
5. Communicates to all parties

## Quick Reference

### Starting a Request
Always start with **Chief Architect**. Provide:
- Clear description of what you want
- Context (why it's needed)
- Any constraints

### After Implementation
1. Test the changes
2. Refresh GitHub files in ALL projects
3. Report results to Chief Architect if issues
