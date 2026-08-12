# referral-tracking-system

This file loads in full at the start of every session in this repo — keep it short. Longer design discussion goes in `docs/*.md`, not here.

## Multi-session delegation

Work here often splits across a planning/testing session and an implementation-only session.

- **Implementation session:** apply exactly the diff/instructions you're given — exact file, line(s), before/after code. Do not self-investigate, do not add debug logging (`console.log` etc.) to hunt for a root cause, do not go down open-ended debugging. Self-verification is capped at ~10% of task effort — running an existing typecheck/build/test command to confirm a given patch is clean is fine; forming your own hypotheses about *why* something is broken is not. Before reporting a task done: remove all debug logging you added, and confirm the standards below aren't broken.
- **Planning/testing session:** owns root-causing and live verification (browser, curl, typecheck) — hand over exact patches, not "investigate X and fix it."
- Never report a fix "done" or "verified" without having reproduced it actually working — not just that a request fired, a file changed, or typecheck passed in isolation.

## Conventions

- Forms: always `react-hook-form` (`useForm` + `zodResolver` + `useFormField`) — never raw `useState` for form fields.
- Check `web/src/components/custom/` before reaching for a raw shadcn/tanstack component.
- All password hashing goes through `api/src/lib/password.ts` (Argon2id) — never better-auth/crypto directly.
- Migrations: pre-release, collapse history — `rm -rf` the migrations folder and regenerate fresh rather than accumulate.
- Seed data: faker seeded by year-of-usage; standard logins are `{role}@gmail.com` / `Password@123`.
- Docker: API-only container for backend tests, full compose stack for e2e. Before `docker compose down`: sign out of the app in the browser and close the tab first.
- Parked/long-term ideas live in `docs/backlog.md`, not in chat memory.
