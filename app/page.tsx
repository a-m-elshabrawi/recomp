import type { Metadata } from "next";
import Link from "next/link";
import {
  Dumbbell,
  Scale,
  LineChart,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { PlateRack } from "@/components/landing/plate-rack";
import { BarbellPlates } from "@/components/training-ledger/barbell-plates";
import { StatCard } from "@/components/dashboard/stat-card";

export const metadata: Metadata = {
  title: "Recomp — The training ledger for body recomposition",
  description:
    "Recomp logs your lifts against a real program, tracks weight and nutrition against real targets, and charts the months it takes to change your body — with an AI coach that reads your own numbers.",
};

// Shared CTA styling. Kept as plain <Link>s rather than the app's <Button>
// (which caps out small) so the hero actions read at landing-page scale,
// while keeping the palette and an unmistakable keyboard focus ring.
const CTA_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt-light focus-visible:ring-offset-2 focus-visible:ring-offset-ink";
const CTA_PRIMARY = `inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cobalt px-6 text-base font-semibold text-chalk transition-colors hover:bg-cobalt-light ${CTA_FOCUS}`;
const CTA_SECONDARY = `inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-steel-light bg-ink-lighter/50 px-6 text-base font-semibold text-chalk transition-colors hover:border-powder-dark hover:bg-steel ${CTA_FOCUS}`;
const LINK_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt-light focus-visible:ring-offset-2 focus-visible:ring-offset-ink rounded-sm";

const FEATURES = [
  {
    icon: Dumbbell,
    title: "Log every set against your program",
    body: "Today's workout is already loaded from your active program. Log reps set by set as you move through it, then mark the session done — no typing exercises from scratch, no guessing what's next.",
  },
  {
    icon: Scale,
    title: "Weigh in, and track what you eat",
    body: "Record daily weight and log nutrition against calorie and macro targets tuned to your maintenance. A 7-day average smooths the day-to-day noise so the scale stops lying to you.",
  },
  {
    icon: LineChart,
    title: "See the long game in charts",
    body: "Weight trend, strength per lift, and week-over-week consistency. The graphs answer the only question that matters in a recomp: over months, is this actually working?",
  },
  {
    icon: Sparkles,
    title: "A coach that reads your data",
    body: "Ask the AI coach about your training and it answers from your logs — your program, recent sessions, weight trend, and targets — not generic advice pulled from nowhere.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-ink text-chalk">
      {/* ---- Public top bar (no session; distinct from the app nav) ------ */}
      <header className="border-b border-steel-light/50">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
          <Link
            href="/"
            className={`font-display text-xl font-semibold tracking-tight ${LINK_FOCUS}`}
          >
            RECOMP
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className={`inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-chalk-muted transition-colors hover:text-chalk ${LINK_FOCUS}`}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg bg-cobalt px-4 text-sm font-semibold text-chalk transition-colors hover:bg-cobalt-light ${CTA_FOCUS}`}
            >
              Start logging
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ---- Hero: the ambient plate-rack signature moment ------------- */}
        <section className="relative overflow-hidden border-b border-steel-light/40">
          {/* Backdrop rack, biased to the right and masked so it fades out
              before it reaches the copy. Dimmer on small screens where the
              text sits directly over it. */}
          <div className="pointer-events-none absolute inset-0 select-none">
            <PlateRack className="absolute inset-y-0 right-0 h-full w-full opacity-25 [mask-image:linear-gradient(to_left,black_0%,black_30%,transparent_78%)] md:w-[70%] md:opacity-60" />
          </div>
          {/* Legibility scrim over the copy column. */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink to-transparent" />

          <div className="relative mx-auto w-full max-w-5xl px-4 py-24 md:py-36">
            <div className="max-w-2xl">
              <p className="stat-label text-cobalt-light">
                Training &amp; nutrition, logged for real
              </p>
              <h1 className="mt-4 font-display text-5xl leading-[0.95] font-semibold tracking-tight text-chalk uppercase sm:text-6xl md:text-7xl">
                The training ledger for body recomposition
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-chalk-muted">
                Recomp logs your lifts against a real program, tracks weight and
                nutrition against real targets, and charts the months it takes
                to actually change your body — with an AI coach that reads your
                own numbers. Built to be used seriously, not another wellness
                app.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/signup" className={CTA_PRIMARY}>
                  Start logging
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link href="/login" className={CTA_SECONDARY}>
                  Log in
                </Link>
              </div>
              <p className="mt-5 stat-caption">
                No streak-shaming. No generic advice. Just your numbers, tracked
                properly.
              </p>
            </div>
          </div>
        </section>

        {/* ---- What it does --------------------------------------------- */}
        <section className="mx-auto w-full max-w-5xl px-4 py-20 md:py-28">
          <div className="max-w-2xl">
            <p className="stat-label text-cobalt-light">What it does</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-chalk uppercase sm:text-4xl">
              Everything a recomp needs — and nothing it doesn&apos;t
            </h2>
            <p className="mt-4 text-base leading-relaxed text-chalk-muted">
              Four things, done properly, instead of forty half-finished
              wellness features. Every screen is built around the loop of a
              serious lifter: train, log, weigh in, review.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="flex flex-col gap-4 rounded-lg border border-steel-light bg-steel/60 p-6"
              >
                <span className="flex size-11 items-center justify-center rounded-lg bg-cobalt/10 text-cobalt-light ring-1 ring-inset ring-cobalt/25">
                  <feature.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-semibold text-chalk">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-chalk-muted">
                  {feature.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ---- A glimpse of the design ---------------------------------- */}
        <section className="border-y border-steel-light/40 bg-steel-dark/40">
          <div className="mx-auto grid w-full max-w-5xl gap-12 px-4 py-20 md:grid-cols-2 md:items-center md:py-28">
            <div className="max-w-lg">
              <p className="stat-label text-cobalt-light">A glimpse of the app</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-chalk uppercase sm:text-4xl">
                Progress you can read at a glance
              </h2>
              <p className="mt-4 text-base leading-relaxed text-chalk-muted">
                The whole app speaks one visual language — a lifter&apos;s
                logbook crossed with load-plate calibration markings. Sessions
                this week aren&apos;t a number in a box; they&apos;re plates on
                the bar, filling in as you train.
              </p>

              <div className="mt-8 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <span className="stat-value-sm w-12 text-chalk-muted">
                    2/4
                  </span>
                  <BarbellPlates completed={2} total={4} size="lg" />
                  <span className="stat-caption">mid-week</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="stat-value-sm w-12">4/4</span>
                  <BarbellPlates completed={4} total={4} size="lg" />
                  <span className="stat-caption text-cobalt-light">
                    week complete
                  </span>
                </div>
              </div>
            </div>

            {/* A faithful lift of the real dashboard stat row. */}
            <div className="rounded-lg border border-steel-light bg-ink/60 p-5">
              <p className="stat-label mb-4">This week&apos;s ledger</p>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Current weight" value="82.4 kg" />
                <StatCard label="7-day avg weight" value="82.9 kg" />
                <StatCard label="This week" hint="sessions completed">
                  <BarbellPlates completed={4} total={4} size="sm" />
                </StatCard>
                <StatCard label="Streak" value="6" hint="weeks" />
              </div>
            </div>
          </div>
        </section>

        {/* ---- Final CTA ------------------------------------------------- */}
        <section className="mx-auto w-full max-w-5xl px-4 py-24 text-center md:py-32">
          <h2 className="mx-auto max-w-2xl font-display text-4xl font-semibold tracking-tight text-chalk uppercase sm:text-5xl">
            Log your first session today
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-chalk-muted">
            Create an account, load your program, and put your first set on the
            record. Recomp keeps the ledger from there.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup" className={CTA_PRIMARY}>
              Create your account
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/login" className={CTA_SECONDARY}>
              I already have one
            </Link>
          </div>
        </section>
      </main>

      {/* ---- Footer ----------------------------------------------------- */}
      <footer className="border-t border-steel-light/50">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
          <span className="font-display text-sm font-semibold tracking-tight text-chalk-muted">
            RECOMP — a training ledger
          </span>
          <div className="flex items-center gap-5 text-sm text-chalk-muted">
            <Link href="/login" className={`hover:text-chalk ${LINK_FOCUS}`}>
              Log in
            </Link>
            <Link href="/signup" className={`hover:text-chalk ${LINK_FOCUS}`}>
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
