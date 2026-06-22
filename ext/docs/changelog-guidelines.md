# Changelog guidelines

## `docs/problem-solution-changelog.md`

Use this for implementation notes that explain why a change happened and how it was solved.

Update it when a change involved a non-obvious bug, design tradeoff, refactor, migration, compatibility issue, data model/access-control decision, or operational lesson.

Entry style:

```markdown
## Short descriptive title

Problem: what was wrong or confusing.

Solution: what changed and why this solves it.
```

Keep entries focused. Do not paste raw logs unless the exact output is important.

## Rotation

Before appending to any changelog, check the target file size.

If a changelog file is larger than 20 KB, rotate it before writing the new entry:

1. Create `docs/old-changelogs/` if it does not already exist.
2. Move the oversized changelog into `docs/old-changelogs/`.
3. Use a unique archived filename that preserves the original changelog name and date, for example:
   - `docs/old-changelogs/problem-solution-changelog-2026-05-30.md`
4. Recreate the active changelog file with its normal title and add the new entry there.
5. Do not split or rewrite old entries during rotation unless explicitly asked.

This rotation rule applies to every changelog file in `docs/` and any future changelog files.

## Plan-step completion rule

After successfully completing a step in a plan, update the relevant changelog file(s) and commit the completed step when all of the following are true:

- the step completed without errors;
- verification passed;
- there are no unresolved questions that require user input before committing;
- the commit can be scoped cleanly to the completed step.
