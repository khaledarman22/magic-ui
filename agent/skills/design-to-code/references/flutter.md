# Flutter handoff

Map exported stable components to widgets and explicit variant properties. Translate observed horizontal/vertical flow to Row/Column; use Expanded only for genuine fill sizing in a bounded parent. Use Stack/Positioned for observed overlays. Map tokens into ThemeData or a project ThemeExtension and preserve asset paths and directionality.

List constraints that cannot map directly, text scaling assumptions, missing states and responsive unknowns. Write the widget hierarchy and token/asset mapping in `instructions/flutter.md`. This phase does not generate or run a Flutter application; no Dart/runtime verification is claimed.
