---
title: "Fail on Paper First"
meta_title: "Fail on Paper First - Imagine the Launch Failed"
description: "Before you commit, imagine the launch failed - name why, then fix the plan while rollback is cheap."
key_concept: |
  - Fail on paper first is counting cost before the wall stops mid-air - failure on paper beats surprise in production.
  - [[Risk Management]] without failing on paper first is optimism wearing a spreadsheet.
level_1: "Fail on paper first is imagining the launch failed, naming why, and fixing the plan while rollback is still cheap."
level_2: "Ask what would make this birthday party flop before you send invites - cheaper to fix on the whiteboard than in tears Saturday."
level_3: "The room assumes the project died - list causes, then patch the plan before anyone ships."
level_4: "Pairs with [[Reversibility]] and [[Rollback Principle]] - failing on paper first asks what triggers the revert before users feel pain."
level_5: "Build a premortem that names likely failure paths, early signals, owners, and rollback triggers before the launch makes each fix expensive."
examples:
  - "Glad we fixed DNS docs and scope before go-live when we listed three ways the client would call angry about the static site."
  - "Team assumed the tournament format failed - whiteboard showed scheduling was the killer; we moved pools before registration opened."
shareable_thought:
  - "Before you commit, imagine the launch failed - name why, then fix the plan while rollback is cheap."
  - "Failure on paper beats surprise in production."
  - "The room assumes the project died - list causes, then patch."
  - "Failing on paper first asks what triggers the revert before users feel pain."
relationships:
  - type: alternative
    wikilink: "[[Count the Cost]]"
    reason: "Faith lane names honest cost before vows"
  - type: contradicts
    wikilink: "[[Ship It]]"
    reason: "when ship-now beats fail-on-paper first"
  - type: extends
    wikilink: "[[Decision Quality]]"
    reason: "Visible failure modes improve the call"
  - type: extends
    wikilink: "[[Reversibility]]"
    reason: "Failing on paper first designs the undo before the commit"
  - type: extends
    wikilink: "[[Risk Management]]"
    reason: "Named risks beat hoped-away risks"
  - type: extends
    wikilink: "[[Rollback Principle]]"
    reason: "Know the revert trigger before deploy"
slug: "fail-on-paper-first"
date: "2026-07-25 11:25:00+08:00"
image: "/images/note.jpg"
categories: ["Leadership"]
author: "JoRap"
tags: ["Decision Making", "Risk Management", "Systems Thinking"]
aliases: ["pre-mortem", "premortem", "run a pre-mortem", "run-a-pre-mortem"]
featured: false
review: false
card_sets: ["Ethics", "Focus"]
cards:
  - front: "Pass to client Friday - DNS anger scenarios still unlisted. What comes first?"
    back: "Fail on paper first - fix docs before go-live."
  - front: "Team assumes tournament format died - whiteboard empty. What's the move?"
    back: "List causes - patch before registration opens."
  - front: "Ego already attached to the launch date - failure modes invisible. What's the move?"
    back: "Imagine it died - name why, then patch."
  - front: "Rollback trigger still vague - deploy clock ticking. What's the move?"
    back: "Write revert trigger - before users feel pain."
  - front: "Optimism spreadsheet says ship - room never assumed failure. What comes first?"
    back: "Room assumes project died - list causes first."
  - front: "Public yes on vows without honest estimate - builder move?"
    back: "Count failure on paper - before the wall stops mid-air."
draft: false
---
