# React handoff

Map exported stable component IDs to React component boundaries; map variant axes to typed props. Use exported tokens as CSS custom properties and flow layout as flexbox where supported by the observed design. Keep absolute positioning for actual overlays. Preserve text, RTL direction and asset mappings from the package.

Document semantic HTML, keyboard interaction and missing states as implementation requirements, not properties proven by Figma. Record responsive rules only when supplied by the design/brief. Provide the intended component tree and a short CSS/token mapping in `instructions/react.md`; this phase does not generate or test a React application.
