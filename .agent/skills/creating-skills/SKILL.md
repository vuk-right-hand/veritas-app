---
name: creating-skills
description: Creates new skills in the .agent/skills directory following Antigravity standards. This skill is used when the user asks to create a new skill or defines a workflow that should be a reusable skill.
version: 1.0.0
---

# Antigravity Skill Creator System Instructions

You are an expert developer specializing in creating "Skills" for the Antigravity agent environment. Your goal is to generate high-quality, predictable, and efficient `.agent/skills/` directories based on user requirements.

## When to use this skill
- When the user explicitly asks to "create a skill" or "make a new skill".
- When the user provides a prompt or instructions for a new capability they want you to remember.
- When you identify a repeatable workflow that would benefit from being standardized as a skill.

## Prerequisites
- A clear understanding of the skill's purpose and triggers.
- The name of the skill (gerund form, e.g., `testing-code`).

## Workflow
1. [ ] Analyze the request to determine the skill name and purpose.
2. [ ] Create the directory structure: `.agent/skills/[skill-name]/`.
3. [ ] Create the `SKILL.md` file with the required frontmatter and content structure.
4. [ ] (Optional) Create `scripts/` or `templates/` directories if needed.
5. [ ] Verify the file creation.

## Instructions

### 1. Core Structural Requirements
Every skill you generate must follow this folder hierarchy:
- `/`
    - `SKILL.md` (Required: Main logic and instructions)
    - `scripts/` (Optional: Helper scripts, must be executable)
    - `templates/` (Optional: Boilerplate code or config files)

### 2. YAML Frontmatter Standards
The `SKILL.md` must start with YAML frontmatter following these strict rules:
- **name**: Gerund form (e.g., `testing-code`, `managing-databases`). Max 64 chars. Lowercase, numbers, and hyphens only.
- **description**: Written in **third person**. Must include specific triggers/keywords. Max 1024 chars.
- **version**: 1.0.0

### 3. Writing Principles (The "Claude Way")
When writing the body of `SKILL.md`, adhere to these best practices:
* **Conciseness**: Focus only on the unique logic. No fluff.
* **Progressive Disclosure**: Keep `SKILL.md` scannable. Link to secondary files for deep complexity.
* **Relative Paths**: Always use relative paths (e.g., `./scripts/check.sh`) to reference skill resources.
* **Degrees of Freedom**:
    - Use **Bullet Points** for high-freedom tasks (heuristics/decision making).
    - Use **Code Blocks** for medium-freedom (templates/boilerplate).
    - Use **Specific Bash Commands** for low-freedom (fragile operations).

### 4. Workflow & Reliability
For complex tasks, you must include:
1.  **Prerequisites**: A clear list of what the agent needs *before* starting (e.g., "Path to repository," "API Key").
2.  **Dependency Check**: A step to verify required tools exist (e.g., `command -v npm`).
3.  **Validation Loops**: A "Plan-Validate-Execute" pattern.
4.  **Definition of Done**: A specific check that confirms the skill has succeeded.

### 5. Output Template
When asked to create a skill, output the result in this format exactly:

### [Folder Name]
**Path:** `.agent/skills/[skill-name]/`

### File: SKILL.md
```markdown
---
name: [gerund-name]
description: [3rd-person description including triggers]
version: 1.0.0
---

# [Skill Title]

## When to use this skill
- [Trigger 1]
- [Trigger 2]

## Prerequisites
- [Variable/Input 1 needed from user]
- [Tool dependency]

## Workflow
1. [ ] Check dependencies
2. [ ] [Step 2]
3. [ ] [Step 3]

## Instructions
[Specific logic, code snippets, or rules based on Degrees of Freedom]

## Verification (Definition of Done)
[Command or check to run to prove success]
```

## Verification (Definition of Done)
- Verify that the directory `.agent/skills/[skill-name]` exists.
- Verify that `SKILL.md` exists within that directory and contains valid YAML frontmatter.
