# Product

## Register

brand

## Users

**Primary:** Potential clients and decision-makers who hire or partner for strategic and technical work, and who care about **ideas, framing, and judgment** as much as delivery.

**Context:** They arrive from search, referrals, or your network. They skim for credibility, clarity, and whether you think in outcomes, not only stack trivia. They may not identify as developers; they need to understand **why you** without wading through insider posture.

## Product Purpose

JoRap Notes is a **personal brand surface** at [jorap.com](https://www.jorap.com): it showcases how you think, what you stand for, and the quality of your work so that the right clients **recognize fit** and reach out with confidence.

Success looks like: visitors leave with a clear sense of **professional credibility**, **distinct point of view**, and **trust** that engaging you is a serious business choice, not a casual follow of a hobby blog.

## Brand Personality

**Voice:** Confident, direct, and composed. You explain complexity without performing it. Warmth is welcome; **whimsy and “fan service” to a tech in-group are not** the main register.

**Three-word personality:** **Professional, idea-led, credible.**

**Emotional goals:** Respect, clarity, and “I’d trust this person in a room with stakeholders,” not “this person’s online persona is a character.”

## Anti-references

- **Performative nerd / dev-bro energy:** Exhaustive flexing, in-jokes as identity, or a site that reads like a gaming stream overlay. You are not optimizing for peer applause at the expense of client comfort.
- **Generic SaaS landing sameness:** Interchangeable hero metrics, stock startup cadence, or template-y “thought leader” filler that could be anyone.
- **Chaotic personal brand:** Cute chaos, irony-as-personality, or visual noise that undermines the signal that you are **easy to work with** and **clear in communication**.

## Design Principles

1. **Ideas before optics.** The interface supports the message; it never competes with it. If a visual choice does not reinforce clarity or trust, it does not ship.

2. **Professional is the baseline, not a mode.** Every page should feel appropriate for a client skim on a laptop between meetings: calm hierarchy, legible type, intentional restraint.

3. **Credibility through restraint.** Show judgment in what you include and what you omit. Dense proof beats loud decoration.

4. **Speak to buyers, not only to builders.** Copy and structure assume intelligent non-specialists; technical depth appears when it serves the reader’s decision, not as default posture.

5. **Consistency builds trust.** Navigation, tone, and visual rhythm should feel like **one** deliberate practice, not a pile of experiments.

## Content surfaces

| Surface | Role | Primary paths |
| --- | --- | --- |
| **Blog** | Long-form essays, credibility, SEO | `/blog/` |
| **Notes garden** | Idea graph, flashcards, backlinks, tools | `/notes/` |
| **Pages** | About, contact, static marketing | `/about/`, etc. |

Blog and notes share one visual system (**restrained editorial**). Notes adds tool UI (graph, filters, flashcards) on the same tokens - see [`DESIGN.md`](./DESIGN.md).

## Visual identity

**North star:** *The Quiet Study* - warm paper, charcoal ink, editorial calm. Full spec: [`DESIGN.md`](./DESIGN.md). Machine-readable tokens: [`DESIGN.json`](./DESIGN.json).

**Style label:** Restrained editorial (minimal in discipline, not in austerity). Warmth and legibility for client skims; no performative tech theater.

**Typography:** Fixed three-role stack — **Source Sans 3** for headings, **Inter** for body and UI chrome, **JetBrains Mono** for code. Roles are not interchangeable; no fourth family without an explicit PRODUCT change. Implementation and tokens: [`DESIGN.md`](./DESIGN.md) (Three-Role Rule).

## Accessibility & Inclusion

- **Target:** Aim for **WCAG 2.1 Level AA** for text contrast, focus visibility, and keyboard use on primary flows (read, navigate, search, contact).
- **Motion:** Respect **`prefers-reduced-motion`** for non-essential animation; avoid motion as the only cue for meaning.
- **Cognitive load:** Prefer plain language in UI chrome and critical paths; reserve depth for article body where readers choose to go long.
