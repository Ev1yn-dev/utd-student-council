// Motion's animation + layout features, loaded after the first render by components/i18n/LocaleProvider.tsx
// (LazyMotion): pages use the light `m` components, so the motion engine is never part of the initial JS.
import { domMax } from "motion/react";

export default domMax;
