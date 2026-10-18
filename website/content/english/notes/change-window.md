---
title: "Change Window"
meta_title: "Change Window - Schedule Risky Changes When Rollback Help Is Awake"
description: "Risky changes ship when someone awake can roll back, not Friday night when everyone is offline."
key_concept: |
  - Rollback Principle fails when rollback owners sleep or attend a wedding.
  - A change window is boring calendar hygiene: deploy Tuesday morning, freeze before holidays, keep the old build one click away.
  - Not fear of shipping - matching risk to coverage.
  - PKM parallel: [[Maintenance Window]] schedules garden prune; change window schedules production risk.
  - I ship risky changes when someone awake can roll back, not Friday night when everyone's offline.
level_1: "A change window is scheduled time for risky updates when people are available to monitor and undo them."
level_2: "It matches deployment risk to coverage so rollback is possible when a change fails."
level_3: "Deploy Tuesday morning, freeze before holidays, and keep the old build one click away."
level_4: "Windows reduce unattended risk but delay changes and require shared rollback skill; urgency does not erase the need for coverage."
level_5: "Design a change-window policy with risk tiers, rollback owners, and a review that improves the next window."
examples:
  - "We stopped Friday-night client deploys after the bad release - glad Tuesday standup owns rollback if it goes loud."
  - "Wedding weekend freeze: marketing edits queue, no Hugo version bumps until Monday."
shareable_thought:
  - "Risky changes ship when someone awake can roll back, not Friday night when everyone is offline."
  - "Rollback Principle fails when rollback owners sleep or attend a wedding."
  - "A change window is boring calendar hygiene: deploy Tuesday morning, freeze before holidays, keep the old build one click away."
  - "PKM parallel: Maintenance Window schedules garden prune; change window schedules production risk."
relationships:
  - type: alternative
    wikilink: "[[Maintenance Window]]"
    reason: "PKM prune schedule vs production deploy schedule"
  - type: contradicts
    wikilink: "[[Ship It]]"
    reason: "when milestone pride ships Friday at 5:01"
  - type: extends
    wikilink: "[[Preparedness]]"
    reason: "Window assumes rehearsed undo path and someone on call"
  - type: extends
    wikilink: "[[Risk Management]]"
    reason: "Time-box exposure to staffed hours"
  - type: extends
    wikilink: "[[Rollback Principle]]"
    reason: "Risky push only when revert crew is reachable"
  - type: extends
    wikilink: "[[Standard Operating Procedures]]"
    reason: "Written deploy windows belong in the runbook"
slug: "change-window"
date: "2026-07-01 14:00:00+08:00"
image: "/images/note.jpg"
categories: ["Leadership"]
author: "JoRap"
tags: ["Safety", "DevOps", "Systems Thinking", "Leadership"]
aliases: ["deploy window", "release window"]
featured: false
review: false
card_sets: ["Ethics", "Focus"]
cards:
  - front: "Client site ready Friday 5pm. When do we push?"
    back: "Tuesday standup - rollback crew stays awake"
  - front: "Wedding weekend - marketing wants a Hugo bump. What's the move?"
    back: "Queue edits - no version bumps until Monday"
  - front: "Bad deploy last Friday - nobody could revert until Monday. What's the rule now?"
    back: "Change window - staffed hours only"
  - front: "Risky deploy and I'm the only one who knows git revert. What's missing?"
    back: "Window plus shared runbook - not heroics at midnight"
  - front: "Friday night deploy bit us - Tuesday standup move?"
    back: "Schedule risky changes in the window."
  - front: "Only I know git revert - team deploys blind. What comes first?"
    back: "Teach revert before the risky push."
draft: false
---
