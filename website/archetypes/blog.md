---
title: "{{ replace .Name "-" " " | title }}"
meta_title: "{{ replace .Name "-" " " | title }}"
description: ""
social_media_intro: ""
social_media_intro_x: ""
slug: "{{ .Name }}"
date: {{ .Date }}
image: "/images/image-template.jpg"
image_prompt: ""
categories: []
author: "JoRap"
tags: []
featured: false
draft: true
---

<!-- ANTI-SLOP: delete before publish.
[ ] Opens with experience, not a dictionary definition
[ ] One specific per major section (number, name, place, failure)
[ ] No "Expanded from ideas.jorap.com" footer
[ ] Replace image-template.jpg
[ ] pnpm lint:blog && pnpm lint:voice && pnpm lint:slop
-->