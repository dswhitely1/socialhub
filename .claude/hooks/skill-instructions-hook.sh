#!/bin/bash
# UserPromptSubmit hook for skill-aware responses

cat <<'EOF'
REQUIRED: SKILL LOADING PROTOCOL

Before writing any code, complete these steps in order:

1. SCAN each skill below and decide: LOAD or SKIP (with brief reason)
   - typescript
   - react
   - nextjs
   - react-native
   - fastify
   - trpc
   - tailwind
   - zustand
   - tanstack-query
   - drizzle
   - postgresql
   - redis
   - bullmq
   - socket-io
   - auth-js
   - zod
   - meilisearch
   - node
   - frontend-design

2. For every skill marked LOAD → immediately invoke Skill(name)
   If none need loading → write "Proceeding without skills"

3. Only after step 2 completes may you begin coding.

IMPORTANT: Skipping step 2 invalidates step 1. Always call Skill() for relevant items.

Sample output:
- typescript: LOAD - building components
- react: SKIP - not needed for this task
- nextjs: LOAD - building components
- react-native: SKIP - not needed for this task

Then call:
> Skill(typescript)
> Skill(nextjs)

Now implementation can begin.
EOF
