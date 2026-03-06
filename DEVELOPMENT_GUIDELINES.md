# Enhanced Development Guidelines

## Core Philosophy

> **Think deeply first, ask questions second, code third.**

The goal is accurate implementation over speed. Take time to understand before acting.

---

## Before Writing Any Code

### Step 1: Understand the Current State

- [ ] Read existing code thoroughly (not just the file you're modifying)
- [ ] Understand the architecture and how pieces connect
- [ ] Identify what the code is supposed to do based on:
  - Function/class names
  - File structure
  - Existing patterns in the codebase
  - Comments and documentation

### Step 2: Research & Validate Assumptions

- [ ] Don't assume you know what a file does - verify by reading it
- [ ] Check for existing patterns, utilities, or similar implementations
- [ ] Look at related files to understand dependencies
- [ ] Verify any assumptions about libraries/frameworks being used

### Step 3: Ask Questions (When Unclear)

If anything is ambiguous, ASK before proceeding:
- "What is the intended behavior here?"
- "Is this the right approach for this use case?"
- "Should I handle edge case X or Y?"
- "What's the priority: correctness, performance, or maintainability?"

---

## During Implementation

### Chunk Large Tasks

Break complex changes into smaller, reviewable chunks:

```
1. Understand the problem
2. Plan the approach (written out)
3. Implement incrementally
4. Test/verify each piece
5. Commit and push
```

### Verify Before Committing

- [ ] Does the change actually solve the stated problem?
- [ ] Are there any unintended side effects?
- [ ] Does it follow existing code patterns?
- [ ] Have I tested the critical paths?

---

## Code Quality Questions

Before finalizing any change, ask:

1. **Correctness**: Does this actually fix the issue?
2. **Scope**: Am I doing more than asked? (Avoid scope creep)
3. **Patterns**: Does this match existing code conventions?
4. **Risk**: What could break? What's the worst case?
5. **Reversibility**: Can this be easily undone if needed?

---

## When Analysis is Needed

### For Bug Fixes
1. Understand the symptom - what actually happens?
2. Find the root cause - don't treat symptoms
3. Verify the fix actually resolves the root cause

### For New Features
1. Understand the full requirement
2. Check existing code for similar patterns
3. Plan the data flow
4. Consider edge cases

### For Optimizations
1. Measure first (if possible)
2. Understand the actual bottleneck
3. Verify optimization doesn't break functionality
4. Consider if it's worth the complexity

---

## Communication Guidelines

### When Proposing Changes
- Explain WHAT you're changing
- Explain WHY (the reasoning)
- Ask for confirmation before major changes

### When Unsure
- Ask clarifying questions
- Present options with tradeoffs
- Don't assume user intent - verify it

### When Report is Given (e.g., from AI analysis)
- Evaluate each point critically
- Distinguish between critical issues and nice-to-haves
- Ask: "Is this actually a problem for our use case?"
- Prioritize based on actual impact, not theoretical concerns

---

## Anti-Patterns to Avoid

| Instead of... | Do this... |
|--------------|------------|
| Assuming file purpose | Read and verify |
| Rushing to code | Plan first |
| Implementing everything at once | Chunk and iterate |
| Trusting AI reports blindly | Validate with testing |
| Adding features without asking | Confirm scope first |
| Fixing perceived issues without confirmation | Verify with user |

---

## Example Workflow

### Before (Rush Mode - Avoid)
```
User: Fix the login bug
Dev: *assumes it's auth issue* *writes code* *pushes*
Result: May not fix actual issue, wasted time
```

### After (Think Mode - Preferred)
```
User: Fix the login bug
Dev: 
1. Can you describe what happens when login fails?
2. Is there an error message?
3. Does it work on a specific platform?
4. *asks clarifying questions*
5. *understands actual issue*
6. *plans fix*
7. *implements*
8. *verifies*
Result: Accurate fix, better understanding
```

---

## Summary

```
┌─────────────────────────────────────────────────────────┐
│  CURIOUS → UNDERSTAND → QUESTION → PLAN → IMPLEMENT   │
│                                                         │
│  Speed is secondary to correctness.                    │
│  Asking questions is strength, not weakness.           │
│  Chunk big tasks. Verify incrementally.                 │
└─────────────────────────────────────────────────────────┘
```

---

*Last Updated: March 2026*
