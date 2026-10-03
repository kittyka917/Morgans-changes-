# Morgan's Systems — MAINSTREET-RP

**Source repo:** MAINSTREET-RP, branch `dev` (local working copy: `C:/CITY/MAINSTREET-RP`)
**Work covered:** 157 commits by Morgan, 19 Sep – 3 Oct
**Handover written for:** Stim

> **Read this first.** The sections below are grouped as
> *built from scratch*, *changed*, and *removed*. Anything marked
> **`NEEDS SOURCE`** is a real gap — the change exists, but its exact name or
> detail has not been transcribed out of the code yet. See
> [`docs/SOURCING.md`](docs/SOURCING.md).

---

## 1. Systems built from scratch

### AI Medic — resource `mainstreet_aimedic`

A new standalone resource. An AI medic that players can call for themselves
rather than waiting on an on-duty EMS player.

- Summoned by players with the **`F` key**, not a chat command.
- Ties into the death/respawn work below (see §2.1) — the medic is part of
  the same down-and-recover loop, which is why that system was reworked
  alongside it.

**`NEEDS SOURCE`** — exact revive behaviour, cooldown, cost, where it will and
won't spawn, and whether it is restricted by job or availability.

### Custom weapons — resource `mainstreet_customweapons`

A new standalone resource holding add-on weapons.

- **Glock** (add-on)
- **Glock 19** (add-on)

Both are add-on weapons, meaning they are additional weapon entries rather
than reskins of base GTA weapons — so they need the resource present and
streamed, and they carry their own weapon hashes.

**`NEEDS SOURCE`** — the weapon hashes/spawn names, ammo type, attachment
support, and which jobs or shops they were made available to.

---

## 2. Systems changed

These already existed on the server. Morgan reworked them.

### 2.1 Death / respawn and the crutch

Reworked the death and respawn flow, including a **crutch** state — the
in-between where a player is injured and mobility-limited rather than simply
dead or simply fine. Connected to the AI medic in §1.

**`NEEDS SOURCE`** — the crutch trigger conditions, how long it lasts, what it
restricts, and how a player clears it.

### 2.2 Clothing thumbnails

Changes to how clothing items are previewed. Related to the `/capclothes`
command and its thumbnail capture flow (see §3 and §4).

### 2.3 Party banners

Changes to the party banner display.

### 2.4 AFL console

Changes to the AFL (showcase) console. The AFL showcase commands in §3 are the
player-facing side of this.

### 2.5 HUD

Changes to the HUD.

### 2.6 Hunger / thirst

Changes to the hunger and thirst system.

### 2.7 Smaller changes

Each of these was touched, but more lightly than the systems above:

- **Interaction** — ***likely the third-eye system.*** On a FiveM server
  "interaction" at this layer is normally the target/third-eye resource
  (`ox_target` / `qb-target` style). This has **not been confirmed against the
  code**, and Stim has specifically asked about the third eye, so this is the
  single highest-priority gap in this document. **`NEEDS SOURCE`**
- **Chat**
- **Airdrop**
- **Radio**
- **Loadscreen**
- **Barber**

---

## 3. Commands

**18 commands Morgan added are still live in the code.** They fall into three
groups:

### Players

Available to ordinary players.

- **`F` key — summon AI medic** (a keybind, not a typed command; see §1)
- **`NEEDS SOURCE`** — remaining player commands in this group

### AFL showcase

The player/host-facing commands for the AFL showcase system (see §2.4).

- **`NEEDS SOURCE`** — command names and permission level

### Dev / testing tools

Restricted tooling, not for players.

- **`/capclothes`** — clothing thumbnail capture. Now performs its own
  automatic check internally; that check used to be three separate manual
  commands (see §4).
- **`NEEDS SOURCE`** — remaining dev commands in this group

> Every one of the 18 has a known permission level in the source — each command
> was read for *who can run it* as well as *what it does*. That mapping needs
> transcribing; see [`docs/commands.md`](docs/commands.md).

---

## 4. Commands removed

These three existed and have since been deleted. If Stim finds them referenced
in an old note, guide or video, **they no longer work:**

| Removed command | Replaced by |
|---|---|
| `/captest` | folded into `/capclothes` as an automatic check |
| `/capwrite` | folded into `/capclothes` as an automatic check |
| `/capls` | folded into `/capclothes` as an automatic check |

All three were debug commands for the clothing thumbnail capture flow. The work
they did by hand now happens automatically inside `/capclothes`, so there is
nothing to run in their place.

---

## 5. Verifying this document against the code

Run these in the MAINSTREET-RP working copy to check the command list in §3
against what is actually registered:

```bash
# Every command registered anywhere in the resources
grep -rn "RegisterCommand" resources/ --include=*.lua

# Narrow to the ones Morgan's commits introduced
git log --author="Morgan" -p --since=2026-09-19 -- resources/ | grep "RegisterCommand"
```

Adjust `--author` to match the actual committer name in `git log` — the filter
only works if it matches.

---

## 6. Keeping this current

Any future change to a system or command on MAINSTREET-RP should update this
file in the same commit, including the commit count and date range at the top.
A handover doc that drifts from the code is worse than no handover doc, because
it is believed.
