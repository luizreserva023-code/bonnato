import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Observer } from "gsap/Observer";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

gsap.registerPlugin(useGSAP, Observer, ScrollTrigger, ScrollToPlugin);

export {
  Observer,
  ScrollToPlugin,
  ScrollTrigger,
  gsap,
  useGSAP,
};
