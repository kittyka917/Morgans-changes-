# Command Reference — Morgan's additions to MAINSTREET-RP

Quick-lookup table for the commands Morgan added. Fill the `NEEDS SOURCE` rows
from the MAINSTREET-RP working copy — `MORGAN-SYSTEMS.md` §5 has the grep
commands that list them.

## Live commands (18 total)

| Command | Group | Who can run it | What it does |
|---|---|---|---|
| `F` (keybind) | Players | Players | Summons the AI medic (`mainstreet_aimedic`) |
| `/capclothes` | Dev / testing | `NEEDS SOURCE` | Captures clothing thumbnails; runs its own automatic check internally |
| `NEEDS SOURCE` | Players | | |
| `NEEDS SOURCE` | Players | | |
| `NEEDS SOURCE` | AFL showcase | | |
| `NEEDS SOURCE` | AFL showcase | | |
| `NEEDS SOURCE` | Dev / testing | | |

**2 of 18 recorded.** The row count above is deliberately short of 18 rather
than padded with invented names — see `docs/SOURCING.md`.

## Removed commands

These are gone. They do not work. Listed so old references can be recognised.

| Command | Group | Replaced by |
|---|---|---|
| `/captest` | Dev / testing | automatic check inside `/capclothes` |
| `/capwrite` | Dev / testing | automatic check inside `/capclothes` |
| `/capls` | Dev / testing | automatic check inside `/capclothes` |

## Permission levels

Each live command has a defined permission level in the source. When filling the
table, take the value from the command's own registration rather than assuming
it from the group — the grouping is by purpose, not by permission, and a
dev-group command is not automatically admin-locked.
