# Phase 14 - File Attachments Feature Audit - Task Breakdown

**Feature**: File Attachments System (Images, Documents, Files)
**Complexity**: M (Medium - Audit & Verification)
**Estimated Duration**: 4-6 hours
**Branch**: `001-slack-messaging`
**Created**: 2026-01-01

---

## Context

Phase 14 implemented file attachment capabilities across the messaging system (channels, DMs, threads). This audit verifies:
- All files are correctly implemented
- Security measures are in place
- Features work as expected
- Code quality meets project standards
- System is ready for commit

---

## Prerequisites

- [x] Phase 14 file attachments implemented
- [x] Working on branch `001-slack-messaging`
- [ ] File inventory complete
- [ ] Security review complete
- [ ] Code quality review complete
- [ ] Test coverage verified

---

## Phase 1: File Inventory & Discovery

| ID | Task | Agent | Depends | Parallel |
|----|------|-------|---------|----------|
| T001 | **File Discovery**: Search and catalog ALL files related to attachments system | debugger-investigator | - | ✗ |
| T002 | **Change Analysis**: Compare with git history to identify what changed vs what's new | debugger-investigator | T001 | ✗ |
| T003 | **Dependency Audit**: Verify UploadThing package installation and configuration | backend-engineer | T001 | ✓ |

### T001 Details: File Discovery
**Output Required**: Complete file manifest in `specs/phase14-audit/file-inventory.md`

**Files to catalog** (known scope):
- Frontend Components:
  - `src/components/messaging/file-upload-button.tsx`
  - `src/components/messaging/image-attachment.tsx`
  - `src/components/messaging/file-attachment.tsx`
  - `src/components/messaging/message-input.tsx` (modified)
  - `src/components/messaging/message-item.tsx` (modified)
  - `src/app/(dashboard)/messages/dm/[conversationId]/components/dm-message-input.tsx` (modified)
  - `src/app/(dashboard)/messages/dm/[conversationId]/components/dm-message-list.tsx` (modified)

- Backend/Convex:
  - `convex/attachments.ts`
  - `convex/messages/channelSendMutation.ts` (modified)
  - `convex/messages/conversationMutations.ts` (modified)
  - `convex/schema.ts` (modified - attachments field)
  - `convex/files.ts` (if exists)

- Utilities:
  - `src/lib/uploadthing.ts`
  - `src/lib/file-type-utils.ts`
  - `src/lib/file-type-icons.ts`
  - `src/hooks/use-file-upload.ts`
  - `src/app/api/uploadthing/route.ts`

**Search queries**:
```bash
# Find all files mentioning attachments
grep -r "attachment" --include="*.ts" --include="*.tsx" src/ convex/

# Find all UploadThing references
grep -r "uploadthing" --include="*.ts" --include="*.tsx" src/

# Find fileUrl references in schema/queries
grep -r "fileUrl\|attachments" convex/
```

**Categorize each file**:
- ✅ New file created
- 🔄 Existing file modified
- 📦 Dependency/configuration

### T002 Details: Change Analysis
**Output Required**: Diff analysis in `specs/phase14-audit/changes-log.md`

**Commands**:
```bash
# View changes to existing files
git diff HEAD~20 -- src/components/messaging/message-input.tsx
git diff HEAD~20 -- convex/schema.ts

# View new files
git log --diff-filter=A --name-only --oneline -- src/components/messaging/file-*.tsx
```

### T003 Details: Dependency Audit
**Output Required**: Section in `specs/phase14-audit/file-inventory.md`

**Verify**:
- UploadThing package in `package.json`
- UploadThing environment variables set
- API route configured correctly
- File size limits defined

---

## Phase 2: Security Review

| ID | Task | Agent | Depends | Parallel |
|----|------|-------|---------|----------|
| T004 | **File Upload Security**: Review UploadThing configuration, file size limits, MIME type validation | security-auditor | T001 | ✗ |
| T005 | **Input Validation**: Verify all file inputs are validated before storage | security-auditor | T001 | ✓ |
| T006 | **Authorization**: Verify only authorized users can upload/view attachments | security-auditor | T001 | ✓ |
| T007 | **XSS Prevention**: Check that file names and URLs are properly sanitized | security-auditor | T001 | ✓ |

### Context7 Documentation (Pre-Validated by Orchestrator)

| Technology | Library ID | Reputation | Suggested Topics |
|------------|-----------|------------|------------------|
| UploadThing | `/pingdotgg/uploadthing` | ✅ High | security, validation, configuration |
| Zod | `/colinhacks/zod` | ✅ High | file validation, custom validators |
| Convex | `/get-convex/convex` | ✅ High | file storage, mutations |

**Agent Instructions**:
- Use `get-library-docs()` directly with pre-validated IDs
- Do NOT call `resolve-library-id()` - IDs are verified
- Read `.claude/skills/security/SKILL.md` before review

### T004 Details: File Upload Security
**Focus Areas**:
- File size limits (max 10MB recommended)
- Allowed MIME types (whitelist approach)
- File extension validation
- Upload rate limiting
- Malicious file detection

**Files to Review**:
- `src/lib/uploadthing.ts` - Configuration
- `src/lib/file-type-utils.ts` - Validation logic
- `src/app/api/uploadthing/route.ts` - API endpoint

**Output**: Security findings in `specs/phase14-audit/security-review.md`

### T005 Details: Input Validation
**Focus Areas**:
- Zod schemas for file metadata
- File name sanitization
- URL validation
- Size checks before upload

**Files to Review**:
- `convex/attachments.ts` - Input validators
- `src/hooks/use-file-upload.ts` - Client-side validation

### T006 Details: Authorization
**Focus Areas**:
- `requireAuth()` on upload mutations
- Channel/conversation membership checks
- File access control (who can view?)

**Files to Review**:
- `convex/attachments.ts`
- `convex/messages/channelSendMutation.ts`
- `convex/messages/conversationMutations.ts`

### T007 Details: XSS Prevention
**Focus Areas**:
- File name escaping in UI
- URL sanitization
- No `dangerouslySetInnerHTML` with user file data
- Content Security Policy compliance

**Files to Review**:
- `src/components/messaging/file-attachment.tsx`
- `src/components/messaging/image-attachment.tsx`

---

## Phase 3: Code Quality Review

| ID | Task | Agent | Depends | Parallel |
|----|------|-------|---------|----------|
| T008 | **TypeScript Compliance**: Verify no `any` types, explicit return types, strict mode passes | code-reviewer | T001 | ✗ |
| T009 | **React Patterns**: Check Server/Client component separation, hooks usage, error handling | code-reviewer | T001 | ✓ |
| T010 | **Convex Patterns**: Verify query/mutation structure, validators, indexes | code-reviewer | T001 | ✓ |
| T011 | **UI/UX Review**: Check loading states, error states, accessibility, mobile responsiveness | code-reviewer | T001 | ✓ |

### Required Skills (Pre-Read)

| Skill | Path | Why Needed |
|-------|------|------------|
| React/Next.js | `.claude/skills/react-nextjs/SKILL.md` | Component patterns |
| TypeScript | `.claude/skills/typescript/SKILL.md` | Type checking rules |
| Convex | `.claude/skills/convex/SKILL.md` | Backend patterns |
| UI Components | `.claude/skills/ui-components/SKILL.md` | shadcn/Radix usage |
| Security | `.claude/skills/security/SKILL.md` | Validation patterns |

**Agent Instructions**:
- Read ALL skills listed above before review
- Apply project conventions from `CLAUDE.md`
- Check against quality gates (Rule #5 in CLAUDE.md)

### T008 Details: TypeScript Compliance
**Quality Gates**:
- [ ] `pnpm typecheck` passes
- [ ] No `any` types anywhere
- [ ] All functions have explicit return types
- [ ] All component props properly typed
- [ ] Convex validators match TypeScript types

**Commands**:
```bash
pnpm typecheck
grep -r "any" src/components/messaging/file-*.tsx src/lib/file-*.ts
```

**Output**: Section in `specs/phase14-audit/code-quality.md`

### T009 Details: React Patterns
**Check**:
- [ ] Server Components used by default
- [ ] `"use client"` only where needed (hooks, events)
- [ ] Loading states with `<Skeleton />`
- [ ] Error handling with `toast.error()`
- [ ] No prop drilling (use contexts if needed)
- [ ] Proper cleanup in useEffect

**Files to Review**:
- All `src/components/messaging/*.tsx`
- `src/hooks/use-file-upload.ts`

### T010 Details: Convex Patterns
**Check**:
- [ ] `requireAuth()` on first line of handlers
- [ ] `returns:` validator defined
- [ ] Indexes used (not `.filter()`)
- [ ] JSDoc comments on exports
- [ ] Proper error handling

**Files to Review**:
- `convex/attachments.ts`
- `convex/messages/*.ts` (modified files)

### T011 Details: UI/UX Review
**Check**:
- [ ] Image previews work
- [ ] File type icons display correctly
- [ ] Download links functional
- [ ] Loading spinners during upload
- [ ] Error messages clear and actionable
- [ ] Keyboard accessible
- [ ] Mobile responsive
- [ ] Dark mode support

**Files to Review**:
- `src/components/messaging/file-attachment.tsx`
- `src/components/messaging/image-attachment.tsx`
- `src/components/messaging/file-upload-button.tsx`

---

## Phase 4: Test Coverage & Functionality Verification

| ID | Task | Agent | Depends | Parallel |
|----|------|-------|---------|----------|
| T012 | **Test Coverage Analysis**: Identify what tests exist and what's missing | test-architect | T001 | ✗ |
| T013 | **Manual Testing Plan**: Create test scenarios for file uploads (images, docs, edge cases) | test-architect | T001 | ✓ |
| T014 | **Build Verification**: Ensure production build succeeds | test-architect | T008 | ✗ |

### Required Skills

| Skill | Path |
|-------|------|
| Testing | `.claude/skills/testing/SKILL.md` |

### T012 Details: Test Coverage Analysis
**Search for existing tests**:
```bash
find tests/ -name "*attachment*.test.ts" -o -name "*upload*.test.ts"
grep -r "file-upload\|attachment" tests/
```

**Assess**:
- [ ] Unit tests for file validation utilities
- [ ] Unit tests for Convex attachment mutations
- [ ] Component tests for upload button
- [ ] Component tests for attachment display
- [ ] E2E tests for upload flow
- [ ] Integration tests for attachments in messages

**Output**: `specs/phase14-audit/test-coverage.md`

### T013 Details: Manual Testing Plan
**Test Scenarios**:
1. Upload image (JPG, PNG, GIF, WebP)
2. Upload document (PDF, DOCX, TXT)
3. Upload large file (near limit)
4. Upload invalid file type
5. Upload while offline
6. View attachment in channel message
7. View attachment in DM
8. View attachment in thread
9. Download attachment
10. Delete message with attachment

**Output**: Checklist in `specs/phase14-audit/manual-testing.md`

### T014 Details: Build Verification
**Commands**:
```bash
pnpm build
pnpm lint
pnpm typecheck
```

**Output**: Build log in `specs/phase14-audit/build-verification.md`

---

## Phase 5: Compile Final Audit Report

| ID | Task | Agent | Depends | Parallel |
|----|------|-------|---------|----------|
| T015 | **Aggregate Findings**: Combine all audit outputs into comprehensive report | orchestrator (you) | T002, T007, T011, T014 | ✗ |
| T016 | **Risk Assessment**: Identify blockers, warnings, and recommendations | orchestrator (you) | T015 | ✗ |
| T017 | **Commit Readiness**: Determine if Phase 14 is ready to commit | orchestrator (you) | T016 | ✗ |

### T015 Details: Aggregate Findings
**Compile into** `specs/phase14-audit/AUDIT-REPORT.md`:

**Structure**:
```markdown
# Phase 14 - File Attachments Audit Report

## Executive Summary
- Feature scope delivered
- Security posture
- Code quality assessment
- Commit recommendation

## 1. File Inventory
[From T001-T003]

## 2. Security Review
[From T004-T007]

## 3. Code Quality
[From T008-T011]

## 4. Test Coverage
[From T012-T014]

## 5. Known Issues
- List any bugs found
- List any limitations
- List any tech debt

## 6. Recommendations
- Fix before commit (blockers)
- Fix after commit (warnings)
- Future improvements (nice-to-have)

## 7. Commit Decision
✅ Ready to commit
⚠️ Ready with caveats
❌ Not ready - blockers present
```

### T016 Details: Risk Assessment
**Categorize findings**:
- 🚨 **BLOCKER**: Must fix before commit (security vulnerabilities, broken features)
- ⚠️ **WARNING**: Should fix soon (performance issues, missing tests)
- 📝 **NOTE**: Future improvement (tech debt, optimization opportunities)

### T017 Details: Commit Readiness
**Decision Criteria**:
- [ ] No BLOCKER issues
- [ ] TypeScript compiles
- [ ] Build succeeds
- [ ] No console errors in dev
- [ ] Security review passed
- [ ] Core functionality works

**If READY**: Prepare commit message template
**If NOT READY**: Create issue list for fixes

---

## Quality Gates

Before marking audit complete:

### Standard Quality Gates
- [ ] All tasks T001-T014 completed
- [ ] All agent outputs generated
- [ ] No unresolved questions
- [ ] Final report written

### Audit-Specific Gates
- [ ] File inventory 100% complete
- [ ] Security review covers all upload paths
- [ ] Code quality review references project skills
- [ ] Test coverage gaps documented
- [ ] Build verification successful

---

## Risks Identified

| Risk | Mitigation |
|------|-----------|
| Missing test coverage | Document in T012, recommend post-commit test task |
| UploadThing env vars not set | Check in T003, fail audit if missing |
| File size limits not enforced | Verify in T004, fail security review if absent |
| No malware scanning | Document limitation, recommend future enhancement |

---

## Critical Path

```
T001 (File Discovery)
  ↓
T002 (Change Analysis)
  ↓
[PARALLEL]
  ├── T004-T007 (Security Review)
  ├── T008-T011 (Code Quality)
  └── T012-T014 (Testing)
  ↓
T015 (Aggregate Findings)
  ↓
T016 (Risk Assessment)
  ↓
T017 (Commit Decision)
```

**Estimated Total Duration**: 4-6 hours

---

## Deliverables

1. `specs/phase14-audit/file-inventory.md` - Complete file manifest
2. `specs/phase14-audit/changes-log.md` - Git diff analysis
3. `specs/phase14-audit/security-review.md` - Security findings
4. `specs/phase14-audit/code-quality.md` - Code review findings
5. `specs/phase14-audit/test-coverage.md` - Test gap analysis
6. `specs/phase14-audit/manual-testing.md` - Test scenario checklist
7. `specs/phase14-audit/build-verification.md` - Build logs
8. `specs/phase14-audit/AUDIT-REPORT.md` - Final comprehensive report

---

## Next Steps After Audit

**If Audit Passes**:
1. Commit changes with detailed message
2. Update Phase 14 status to ✅ Complete
3. Move to Phase 15 (if applicable)

**If Audit Fails**:
1. Create GitHub issues for each blocker
2. Delegate fixes to appropriate agents
3. Re-run audit after fixes

---

## Agent Coordination

**Agents Involved**:
- `debugger-investigator` - File discovery and change analysis
- `security-auditor` - Security review (T004-T007)
- `code-reviewer` - Code quality review (T008-T011)
- `test-architect` - Test coverage and verification (T012-T014)
- `orchestrator` - Final report compilation (T015-T017)

**Communication Protocol**:
- Each agent outputs to designated file in `specs/phase14-audit/`
- Orchestrator aggregates all outputs in T015
- All agents reference project skills before work
- All agents use pre-validated Context7 IDs provided

---

**STATUS**: Ready for execution
**CREATED BY**: task-decomposer
**DATE**: 2026-01-01
