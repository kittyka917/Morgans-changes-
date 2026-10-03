# Sourcing — where these facts came from, and what's missing

## Where the content came from

Everything currently in this repo was taken from the **summary output of
Morgan's Claude session** on MAINSTREET-RP — the session that wrote
`MORGAN-SYSTEMS.md` into that repo and committed it to `dev` as `1a61363e`
(committed, not pushed).

That summary was itself produced by reading the MAINSTREET-RP code, so the
facts recorded here are second-hand but not invented:

- 157 commits, 19 Sep – 3 Oct
- 18 commands added and still live; 3 since removed (`/captest`, `/capwrite`,
  `/capls`), folded into `/capclothes`
- `mainstreet_aimedic` (AI medic, `F` key) and `mainstreet_customweapons`
  (add-on Glock, Glock 19) built from scratch
- Changed: death/respawn + crutch, clothing thumbnails, party banners, AFL
  console, HUD, hunger/thirst
- Lighter changes: interaction, chat, airdrop, radio, loadscreen, barber

## What is NOT in that summary

The summary stated *that* there are 18 live commands in three groups, but
**named only two of them** (`/capclothes`, and the `F` medic keybind). So the
following are genuinely absent and have not been guessed at:

1. **The names of the other 16 live commands**, their permission levels, and
   what each one does.
2. **The third-eye detail.** The summary lists "interaction" as a lighter
   change. On a FiveM server that is usually the target/third-eye resource, but
   that inference has not been checked against code, and no specific third-eye
   change was described. Stim asked about this directly, so it is the top gap.
3. **The UI detail.** HUD, party banners, clothing thumbnails and the AFL
   console are each named as changed, but *what* changed in them — layout,
   elements added or removed, new states — is not described.
4. **Behaviour detail** on the AI medic, the crutch, and the custom weapons
   (cooldowns, restrictions, hashes, availability).

## Why those blanks were left blank

Filling them would mean inventing command names, keybinds and UI descriptions.
A handover doc Stim can't trust is worse than one with honest holes, because a
wrong permission level or a command that doesn't exist costs him more time than
a blank does.

## Two ways to close the gap

### Option A — make MAINSTREET-RP reachable (best)

MAINSTREET-RP is currently local-only; it is not on GitHub, so no Claude cloud
session can read it. Push it to a private GitHub repo under the same account,
then a session can be pointed at it and read every command directly out of the
source.

```bash
# in C:/CITY/MAINSTREET-RP
git remote -v                 # check whether a GitHub remote already exists
```

Once it is on GitHub, a session can `add_repo` it and transcribe all 18
commands, the interaction/third-eye diff, and the UI changes with no guessing.

### Option B — paste the existing doc

`MORGAN-SYSTEMS.md` already exists in MAINSTREET-RP at commit `1a61363e` and
contains the full 18-command list with permissions. Paste its contents into a
session and it can be merged into this repo directly.

```bash
# in C:/CITY/MAINSTREET-RP
git show 1a61363e:MORGAN-SYSTEMS.md
```

Option B is faster. Option A is better long-term, because it lets the doc be
re-verified against the code instead of re-typed.

## Note on the source repo's own state

As of the handover, `MORGAN-SYSTEMS.md` was **committed but not pushed** on
`dev`, and a second Claude session was working in MAINSTREET-RP concurrently —
which is why the usual `DEV_UPDATES.md` changelog line was deliberately not
added (two sessions writing that file at once had already produced tangled
commits). Both the push and the changelog line may still be outstanding.
