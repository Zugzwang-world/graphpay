# Relay: foundation (M0)

Updated 21:55 IST, Thu 5 Nov. In progress; rewritten at the end of M0.

## A3 self-check (deny rules hold)

An empty `.env` was created by a script (a direct write is refused once the deny rules load), then:

- `Read` of `.env` → refused: `File is in a directory that is denied by your permission settings.`
- `cat .env` in the shell → refused: `Permission to use Bash with command cat .env has been denied.`

(Claude Code 2.1.318. The pack expected wording like "covered by a Read deny rule"; the refusal text has changed, the block has not.)
