# willon-smith.github.io

Personal site of Willon Smith, AI Engineer and Technical Delivery Lead.
Live at https://willon-smith.github.io/

## What is in it

- `index.html`: the whole page. Content lives here, in plain HTML.
- `css/styles.css`: design tokens, layout, responsive rules.
- `js/main.js`: page motion (GSAP, ScrollTrigger, SplitText), Lenis smooth scroll, reveals, counters, stacking cards, cursor, nav, timeline, contact terminal.
- `js/scene.js`: the Three.js hero. A field of points displaced by GLSL noise, lifted by the pointer and spread by scroll.
- `js/pipeline.js`: the interactive request flow. Nodes, edges, descriptions and the trace lines are data at the top of the file.
- `js/sphere.js`: the rotating word sphere of the stack.
- `assets/`: portrait and the social preview image.
- `willon-smith-cv.pdf`, `willon-smith-portfolio.pdf`: downloads linked from the page.

No build step. Libraries load from jsDelivr and Google Fonts; everything else is static, so GitHub Pages serves the repo root as is.

## Editing

- Copy changes: edit `index.html` directly.
- Availability status: the pill in the hero, the nav status and the last line of the contact terminal.
- The stack sphere words are the `WORDS` list in `js/main.js`; the categories match the `data-cat` values on the filter buttons.
- The pipeline diagram is driven by `NODES`, `EDGES`, `INFO` and `LOGS` in `js/pipeline.js`.

## Running locally

Any static server works. For example:

```
python -m http.server 8765
```

then open http://localhost:8765/. The page needs to be served over HTTP (not opened as a file) because the scripts are ES modules.

## Motion and accessibility

`prefers-reduced-motion: reduce` turns off smooth scroll, the preloader, reveals, the custom cursor and the moving parts of the scene, sphere and pipeline. Content is visible without JavaScript.
