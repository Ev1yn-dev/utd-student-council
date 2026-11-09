"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { Activity, Announcement, Img, L } from "@/lib/content";
import { EmptyState } from "@/components/home/EmptyState";
import { CardItem, DateChip, Lift, Prose, TextCard, ZoneTitle } from "@/components/home/parts";
import { ThBadge, Tx, useL } from "@/components/i18n/LocaleProvider";
import { Gallery } from "@/components/ui/Gallery";
import { Modal } from "@/components/ui/Modal";
import { SmartImage } from "@/components/ui/SmartImage";
import { IconExternal, IconImages, IconLink, IconMegaphone, IconPin, IconStar } from "@/components/icons/Icon";

// Photos are optional everywhere: a card shows an image only when one exists, otherwise a text card.
const CARD = "h-full overflow-hidden border border-line bg-surface shadow-soft transition-shadow duration-300 group-hover:shadow-lift";

/** Body paragraphs in the current language (Thai + "TH" label when English is missing). */
function Body({ v }: { v: L<string[]> }) {
  const pick = useL();
  const { value, fallback } = pick(v);
  return (
    <div lang={fallback ? "th" : undefined}>
      {fallback && <ThBadge className="mb-2 ml-0" />}
      <Prose paragraphs={value} />
    </div>
  );
}

export function NewsTab({ announcements, activities, query, onClear }: {
  announcements: Announcement[]; activities: Activity[]; query: string; onClear: () => void;
}) {
  const t = useTranslations("news");
  const pick = useL();
  const [annId, setAnnId] = useState<string | null>(null);
  const [actId, setActId] = useState<string | null>(null);
  const ann = announcements.find((a) => a.id === annId) ?? null;
  const act = activities.find((a) => a.id === actId) ?? null;

  if (announcements.length === 0 && activities.length === 0) {
    return <div className="grid"><EmptyState query={query} onClear={onClear} kind="news" /></div>;
  }

  return (
    <div className="space-y-12">
      {announcements.length > 0 && (
        <section aria-labelledby="ann-h">
          <ZoneTitle icon={<IconMegaphone width={18} height={18} />} count={announcements.length}><span id="ann-h">{t("announcements")}</span></ZoneTitle>
          <ul className="grid auto-rows-fr items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {announcements.map((a, i) => (
                <CardItem key={a.id} index={i}>
                  <AnnouncementCard a={a} onOpen={() => setAnnId(a.id)} />
                </CardItem>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      {activities.length > 0 && (
        <section aria-labelledby="act-h">
          <ZoneTitle icon={<IconStar width={18} height={18} />} count={activities.length}><span id="act-h">{t("activities")}</span></ZoneTitle>
          {/* photo cards span the full row (reference); text-only cards share rows */}
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {activities.map((a, i) => (
                <CardItem key={a.id} index={i} className={a.photos.length ? "col-span-full" : undefined}>
                  <Lift>
                    <motion.article layoutId={`act-${a.id}`} style={{ borderRadius: 20 }} className={CARD}>
                      <button type="button" onClick={() => setActId(a.id)} aria-haspopup="dialog" className="block h-full w-full text-left">
                        {a.photos.length ? (
                          <WideMedia
                            photos={a.photos}
                            alt={pick(a.title).value}
                            badge={a.photos.length > 1 ? <><IconImages width={14} height={14} /> {t("photos", { n: a.photos.length })}</> : null}
                            caption={<><DateChip iso={a.date} /><span className="font-display font-medium text-strong"><Tx v={a.title} /></span></>}
                          />
                        ) : (
                          <TextCard
                            icon={<IconStar width={18} height={18} />}
                            meta={<DateChip iso={a.date} />}
                            title={<Tx v={a.title} />}
                            excerpt={pick(a.body).value.join(" ")}
                            action={t("details")}
                          />
                        )}
                      </button>
                    </motion.article>
                  </Lift>
                </CardItem>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      <AnimatePresence>
        {ann && (
          <Modal key={ann.id} layoutId={`ann-${ann.id}`} title={t("announcements")} icon={<IconMegaphone width={18} height={18} />} onClose={() => setAnnId(null)} size="md">
            <div className="space-y-4 p-5 sm:p-7">
              <div>
                <h3 className="text-xl font-semibold text-strong sm:text-2xl"><Tx v={ann.title} /></h3>
                <DateChip iso={ann.date} className="mt-1" />
              </div>
              {ann.cover && <SmartImage img={ann.cover} alt={pick(ann.title).value} sizes="640px" className="aspect-[16/9] w-full rounded-2xl" priority />}
              <Body v={ann.body} />
              {ann.link && (
                <a
                  href={ann.link}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-brand-mid px-5 py-3 font-display font-semibold text-brand-mid transition hover:-translate-y-0.5 hover:bg-brand-mid hover:text-white hover:shadow-lift"
                >
                  <IconExternal width={18} height={18} /> {t("openLink")}
                </a>
              )}
            </div>
          </Modal>
        )}
        {act && (
          <Modal key={act.id} layoutId={`act-${act.id}`} title={pick(act.title).value} icon={<IconStar width={18} height={18} />} onClose={() => setActId(null)} size={act.photos.length ? "lg" : "md"}>
            <div className="space-y-5 p-5 sm:p-7">
              <DateChip iso={act.date} />
              {act.photos.length > 0 && <Gallery photos={act.photos} alt={pick(act.title).value} />}
              <Body v={act.body} />
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function AnnouncementCard({ a, onOpen }: { a: Announcement; onOpen: () => void }) {
  const t = useTranslations("news");
  const pick = useL();
  const Icon = a.pinned ? IconPin : IconMegaphone;
  const excerpt = pick(a.body).value.join(" ");
  const linkChip = a.link && (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky text-brand-mid" aria-label={t("hasLink")}><IconLink width={13} height={13} /></span>
  );
  return (
    <Lift>
      <motion.article layoutId={`ann-${a.id}`} style={{ borderRadius: 20 }} className={CARD}>
        <button type="button" onClick={onOpen} className="flex h-full w-full flex-col text-left" aria-haspopup="dialog">
          {a.cover ? (
            <>
              <div className="relative">
                <SmartImage img={a.cover} alt={pick(a.title).value} sizes="(max-width: 640px) 100vw, 420px" className="aspect-[16/8] w-full" imgClassName="group-hover:scale-105" />
                <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-brand-deep/70 text-white shadow backdrop-blur" aria-label={a.pinned ? t("pinned") : undefined}>
                  <Icon width={16} height={16} />
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-5">
                <DateChip iso={a.date} />
                <h3 className="flex items-start gap-2 font-display text-[1.05rem] font-semibold leading-snug text-strong">
                  <span className="line-clamp-2"><Tx v={a.title} /></span>
                  {linkChip}
                </h3>
                <p className="line-clamp-2 text-sm text-muted">{excerpt}</p>
              </div>
            </>
          ) : (
            <TextCard
              icon={<Icon width={18} height={18} />}
              meta={<DateChip iso={a.date} />}
              badge={a.pinned ? <span className="rounded-full bg-pink-soft px-2 py-0.5 text-[0.7rem] font-semibold text-pink-ink">{t("pinned")}</span> : null}
              title={<Tx v={a.title} />}
              excerpt={excerpt}
              footer={linkChip || undefined}
              action={t("readMore")}
            />
          )}
        </button>
      </motion.article>
    </Lift>
  );
}

/** Full-width 16:5 photo strip with a caption bar (reference "ภาพผลงาน"); several photos crossfade every 5 s. */
export function WideMedia({
  photos, alt, caption, badge, footer, imageWrap,
}: {
  photos: Img[]; alt: string; caption: React.ReactNode; badge?: React.ReactNode; footer?: React.ReactNode;
  imageWrap?: (img: React.ReactNode) => React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const [k, setK] = useState(0);
  const n = photos.length;
  useEffect(() => {
    if (reduce || n < 2) return;
    const id = setInterval(() => setK((x) => (x + 1) % n), 5000);
    return () => clearInterval(id);
  }, [n, reduce]);

  const image = (
    <div className="relative aspect-[16/9] w-full overflow-hidden sm:aspect-[16/6] lg:aspect-[16/5]">
      <AnimatePresence initial={false}>
        <motion.div key={k} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1 }}>
          <SmartImage img={photos[k]} alt={alt} sizes="(max-width: 1320px) 100vw, 1320px" className="h-full w-full" imgClassName="group-hover:scale-105" />
        </motion.div>
      </AnimatePresence>
      {badge && <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-brand-deep/70 px-3 py-1 text-xs font-medium text-white backdrop-blur">{badge}</span>}
    </div>
  );
  return (
    <>
      {imageWrap ? imageWrap(image) : image}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-line px-5 py-3.5 text-center text-[0.95rem]">{caption}</div>
      {footer}
    </>
  );
}
