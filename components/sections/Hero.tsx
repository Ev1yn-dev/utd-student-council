import { HeroSlides } from "@/components/sections/HeroSlides";
import { getHeroPhotos } from "@/lib/content";

/**
 * Banner: rounded full-frame slider in the council banners' own ratio (4860x2110 ≈ 2.3:1) on every screen, so the
 * artwork is never cropped (photos of another ratio fill the frame around their focal point) — photos, arrows and dots only;
 * the council name lives in the header, the year in the control bar. A faint shadow at the bottom keeps the dots visible.
 * Slides = approved photos an admin ticked "is_hero"; none -> one gradient slide.
 */
export async function Hero() {
  const photos = await getHeroPhotos();
  return (
    <div className="mx-auto max-w-[1320px] px-4 pt-4 md:pt-7">
      <HeroSlides photos={photos}>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />
      </HeroSlides>
      <div aria-hidden className="mx-auto mt-3 h-[3px] w-2/3 rounded-full bg-gradient-to-r from-transparent via-pink to-transparent opacity-80" />
    </div>
  );
}
