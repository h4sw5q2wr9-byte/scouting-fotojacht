# FOTOJACHT V2 — SIMPLE LOCAL PHOTO VERSION

You are working in my existing GitHub repository for the Scouting site **FOTOJACHT**.
I need a much simpler and better version fast.

## Main goal
Rebuild the current experience into a **simple, fast, mobile-first photo recreation game** for Scouting.
It must feel clean, modern, and fun.

## What is wrong now
- The current site is not good enough yet.
- We do **not** need a timer.
- We do **not** need multiple teams on a single device.
- We **do** need a very quick tutorial.
- The site currently has too many art pieces / illustrations instead of real recognizable reference photos.
- I do **not** want references that send users to another website.
- I want the reference images to be **inside the site itself** as local assets.
- I want a **different visual style** from the current version.

## Build this instead
Create a much simpler app with this flow:
1. Open site
2. See short intro / tutorial
3. Choose a challenge or random challenge
4. See one large built-in reference image
5. Tap one button to make or choose a recreation photo
6. See the original and recreated photo side by side
7. Save progress locally on that phone
8. At the end export a ZIP of that phone's recreated photos

## Remove or simplify
Remove or disable for now:
- timer
- score system with multiple teams on one device
- complex game logic
- unnecessary dashboards
- extra controls that slow people down
- external image search buttons
- references to other websites for the original image

Keep it dead simple.

## Required features
### 1. Local built-in photo references
Every playable challenge must use a **local image file stored in the repo**.
No hotlinks. No Google Images. No redirect to another site.
The user must be able to play fully inside the site.

Use a local structure like:
- `assets/references/`
- `assets/references/sources.json`

Each challenge should point to a local reference image and show:
- title
- category
- difficulty
- how many people are needed

### 2. Quick tutorial
Add a very short tutorial at the top or first open.
For example:
1. Kies een foto
2. Maak hem na
3. Upload jullie versie
4. Vergelijk beide foto's
5. Download alles op het einde

Keep it visual and very short.

### 3. One-device mode
This version is for one device per group.
No multi-team scoreboard on one phone.
Just:
- challenge browser
- favorites optional
- upload / take photo
- local save
- export ZIP

### 4. ZIP export
Add a clear **Download ZIP** button.
Export the recreated photos from that device with:
- readable filenames based on the challenge title
- optional comparison images if easy to generate
- a small summary file such as `index.html` or `results.json`

### 5. New visual style
Change the style.
Do NOT keep the current visual feeling.
Make it:
- bold
- photo-focused
- dark but lively
- modern
- less "app dashboard"
- more like a party game / challenge deck
- large cards
- strong typography
- accent color allowed, for example bright yellow or lime
- playful but clean

### 6. Mobile-first UX
Optimize for iPhone Safari.
Make the main challenge page extremely easy:
- one big image
- clear title
- one main upload button
- next / previous
- random
- done marker

## Content requirements
Replace the weak art-heavy content with **real recognizable reference photos included locally**.
Start by making around **24 to 40 strong challenges** that actually work tonight.
Prioritize quality over quantity.

Include a mix of:
- Dutch memes / Dutch internet culture
- Dutch TV / pop culture
- famous movie scenes
- classic internet memes
- iconic photos recognizable to teens

Only include items when you can provide a proper local image file in the repo.
If a challenge does not have a local reference photo yet, hide it from the playable set.

## Copyright-safe sourcing behavior
Use legitimate reusable / permitted sources where possible.
Prefer:
- public domain
- Wikimedia Commons files with usable licenses
- official reusable press photos when allowed
- self-made replacement reference images only when clearly labeled and good enough

Do not leave broken references.
Do not rely on external search.
Do not present remote images as if they are embedded.

## Repository tasks
1. Preserve a recoverable starting point before major changes.
2. Refactor the current files rather than starting from scratch unless that is clearly faster.
3. Add the local image assets.
4. Wire challenges to those local images.
5. Remove timer and multi-team logic from the main UI.
6. Add quick tutorial.
7. Add ZIP export.
8. Push working updates continuously so I can test.

## Deliverables
When done, provide:
- deployed GitHub Pages URL
- concise summary of what changed
- how many locally embedded reference photos are playable
- where the ZIP export button is

## Important priority order
1. Simpler UI
2. Local embedded photos
3. Quick tutorial
4. Upload and save recreated photo
5. ZIP export
6. New style
7. Extra polish only if time remains

Work fast and keep the solution practical for tonight's Scouting session.
