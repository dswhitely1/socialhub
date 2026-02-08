The skill files have been generated. Here's a summary of what was created:

**3 files created in `.claude/skills/tailwind/`:**

1. **SKILL.md** (107 lines) — Quick overview covering the dual Tailwind setup (v4 web + v3 mobile), key differences table, common patterns, and Context7 documentation queries with resolved library IDs.

2. **references/patterns.md** (148 lines) — Theme token system, variant map pattern, layout composition, shared UI package pattern, mobile NativeWind patterns, and 4 documented anti-patterns (hardcoded colors, adding Tailwind to UI package, web-only utilities in mobile, dynamic class construction, mixed inline styles).

3. **references/workflows.md** (148 lines) — Step-by-step workflows for adding theme tokens (both platforms), creating web/mobile components, adding shared UI components, debugging styles on both platforms, and a WARNING about missing `tailwind-merge`.

Key highlights:
- All code examples are from the actual SocialHub codebase
- Documents the critical web v4 vs mobile v3 split with different config approaches
- Cross-references to **react**, **nextjs**, **react-native**, and **frontend-design** skills
- 18 code blocks across all files
- Checklists for multi-step workflows (adding tokens, adding shared components)