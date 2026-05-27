# Task Handoff Process

This document defines how product, architecture, and development tasks should be written for other project conversations and role-based agents.

## Purpose

Tasks discussed in the project management conversation should be converted into clear task documents before development begins.

The goal is to let other conversations or role owners read a document and implement without relying on chat memory.

## Default Rule

When the Product Manager asks to define, clarify, or assign a task, create or update a document under:

```text
docs/
```

Do not rely only on chat messages for development instructions.

## Recommended Document Types

### Feature Requirement

Use for new modules or major features.

File naming:

```text
docs/[FEATURE_NAME]_REQUIREMENTS.md
```

Example:

```text
docs/CARRIER_BILLING_REQUIREMENTS.md
```

### Task Handoff

Use for implementation tasks assigned to a role.

File naming:

```text
docs/tasks/[YYYY-MM-DD]-[short-task-name].md
```

Example:

```text
docs/tasks/2026-05-27-trip-plan-trailer-truck-number.md
```

### Acceptance Checklist

Use for QA, product walkthrough, or demo validation.

File naming:

```text
docs/[MODULE_NAME]_ACCEPTANCE_CHECKLIST.md
```

### Architecture Note

Use for system design, data model, or enterprise refactor guidance.

File naming:

```text
docs/[TOPIC]_ARCHITECTURE.md
```

## Required Task Handoff Format

Each development task should include:

```text
# [Task Title]

## Owner Role

[Core Developer / UI Support Developer / Debug Specialist / Product Manager]

## Background

Why this task exists and what business problem it solves.

## Scope

What should be changed.

## Out Of Scope

What should not be changed.

## Requirements

Detailed functional or UI requirements.

## Data / Schema Impact

Database, field, import, export, or persistence requirements.

## Expected Files

Likely files or areas involved.

## Acceptance Criteria

Specific checks that prove the task is complete.

## Notes For Developer

Implementation guidance, constraints, and known risks.
```

## Role Guidance

### Core Developer Tasks

Use Core Developer for tasks involving:

- Database schema
- Supabase reads or writes
- Business rules
- State transitions
- Calculations
- Import/export behavior
- Cross-module integration
- Change log or audit behavior

### UI Support Developer Tasks

Use UI Support Developer for tasks involving:

- Layout adjustments
- Styling consistency
- Search/filter/table visual improvements
- Responsive behavior
- Non-core copy or label adjustments
- Small visual bugs

UI Support Developer tasks should explicitly say:

```text
Scope: UI only, no business logic changes.
```

### Debug Specialist Tasks

Use Debug Specialist for tasks involving:

- Bug reproduction
- Root-cause diagnosis
- Browser console or network error investigation
- Supabase error investigation
- Data mismatch investigation
- Regression checks after a fix
- Known issue documentation

Debug Specialist tasks should include:

```text
Issue:
Reproduction:
Expected:
Actual:
Output:
- Root cause
- Affected files or data
- Recommended fix owner
- Verification steps
```

Routing rule:

- UI-only defects should go to UI Support Developer after diagnosis.
- Schema, persistence, calculation, import/export, or state transition defects should go to Core Developer after diagnosis.
- Unclear product behavior should go back to Product Manager for decision.

## Task Status

If useful, include a simple task status:

```text
Status: Draft / Ready for Development / In Development / Ready for Review / Done
```

## Operating Rule For This Project

For future project management conversation tasks:

1. Discuss and clarify the requirement.
2. Write or update the task document.
3. Include owner role and acceptance criteria.
4. Mention the document path in the final response.
5. Let the implementation conversation read the document and perform development.

This keeps planning and implementation separated while preserving shared project context.
