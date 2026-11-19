'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';

import type { CaseImage } from '@/content/work';
import { MonoLabel } from '@/components/typography/mono-label';
import { Reveal } from '@/components/motion/reveal';
import { SCREENSHOT_QUALITY } from './case-screenshot';

export interface GalleryGroup {
  label: string | null;
  images: CaseImage[];
}

/**
 * A case's screenshots, each opening full size.
 *
 * In the page they share a column and their UI text is too small to read, so
 * every shot is a button into a viewer that shows it as large as the screen
 * allows. The viewer is a native modal <dialog>: Escape closes it, focus stays
 * inside it and the page behind is inert, with no focus-trap code here. Arrow
 * keys step through every shot on the page, across groups.
 */
export function CaseGallery({ groups }: { groups: GalleryGroup[] }) {
  const all = groups.flatMap((g) => g.images);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [index, setIndex] = useState(0);
  const current = all[index];

  function open(i: number, trigger: HTMLButtonElement) {
    opener.current = trigger;
    setIndex(i);
    dialog.current?.showModal();
    // A modal dialog does not stop the page behind it from scrolling.
    document.documentElement.style.overflow = 'hidden';
  }

  const close = () => dialog.current?.close();

  // Runs however the dialog closed: button, Escape or a click outside the shot.
  function onClose() {
    document.documentElement.style.overflow = '';
    opener.current?.focus();
  }

  const step = (by: number) => setIndex((i) => (i + by + all.length) % all.length);

  // Where each group's shots start in `all`, so the viewer opens on the
  // right one and steps across groups.
  const starts = groups.map((_, g) =>
    groups.slice(0, g).reduce((n, prev) => n + prev.images.length, 0),
  );

  return (
    <>
      {groups.map((group, g) => {
        const start = starts[g];
        const single = group.images.length === 1;

        return (
          <div key={group.label ?? 'all'}>
            {group.label ? (
              <MonoLabel className="mt-12 block text-[var(--accent-text)]">
                {group.label}
              </MonoLabel>
            ) : null}
            <div className={single ? 'mt-6 max-w-4xl' : 'mt-6 grid gap-10 lg:grid-cols-2'}>
              {group.images.map((img, i) => (
                <Reveal key={img.src.src}>
                  <figure>
                    <button
                      type="button"
                      onClick={(e) => open(start + i, e.currentTarget)}
                      aria-label={`Enlarge screenshot: ${img.alt}`}
                      className="group/shot relative block w-full cursor-zoom-in overflow-hidden rounded-lg border border-[var(--rule-color)] bg-white"
                    >
                      <Image
                        src={img.src}
                        alt={img.alt}
                        quality={SCREENSHOT_QUALITY}
                        placeholder="blur"
                        // Two-up columns are ~40rem at lg; a lone shot gets
                        // max-w-4xl (56rem).
                        sizes={single ? '(min-width: 1024px) 56rem, 100vw' : '(min-width: 1024px) 40rem, 100vw'}
                        className="h-auto w-full"
                      />
                      {/* Always shown on touch screens, where nothing hovers. */}
                      <span
                        aria-hidden
                        className="absolute right-3 top-3 grid h-8 w-8 place-items-center bg-surface-ink/80 text-on-dark-strong transition-opacity md:opacity-0 md:group-hover/shot:opacity-100 md:group-focus-visible/shot:opacity-100"
                      >
                        <ExpandIcon />
                      </span>
                    </button>
                    <figcaption className="mt-4 max-w-[44em] text-body-sm text-[var(--muted-color)]">
                      {img.caption}
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        );
      })}

      <dialog
        ref={dialog}
        aria-label="Screenshot viewer"
        onClose={onClose}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') step(1);
          if (e.key === 'ArrowLeft') step(-1);
        }}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-surface-ink/95 p-0 text-on-dark backdrop:bg-surface-ink/80"
      >
        {current ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
              {/* Not `muted`: that reads the light section's muted colour,
                  which vanishes on the viewer's dark ground. */}
              <MonoLabel size="caption" className="text-on-dark-muted">
                {index + 1} / {all.length}
              </MonoLabel>
              <button
                type="button"
                onClick={close}
                className="flex h-9 items-center gap-2 px-3 font-mono text-label uppercase tracking-[0.12em] text-on-dark-strong"
              >
                Close <CloseIcon />
              </button>
            </div>

            {/* A click on the empty stage around the shot closes, as a click
                on a backdrop would. */}
            <div
              className="relative min-h-0 flex-1 px-4 sm:px-6"
              onClick={(e) => {
                if (e.target === e.currentTarget) close();
              }}
            >
              <Image
                key={current.src.src}
                src={current.src}
                alt={current.alt}
                quality={SCREENSHOT_QUALITY}
                placeholder="blur"
                sizes="92vw"
                className="h-full w-full object-contain"
                style={{ objectFit: 'contain' }}
              />
            </div>

            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="max-w-[60em] text-body-sm text-on-dark">{current.caption}</p>
              {all.length > 1 ? (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    className="h-9 border border-rule-dark px-3 font-mono text-label uppercase tracking-[0.12em] text-on-dark-strong"
                  >
                    ← Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    className="h-9 border border-rule-dark px-3 font-mono text-label uppercase tracking-[0.12em] text-on-dark-strong"
                  >
                    Next →
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}

function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8.5 1.5h4v4M5.5 12.5h-4v-4M12.5 1.5 8 6M1.5 12.5 6 8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="m1.5 1.5 9 9M10.5 1.5l-9 9" />
    </svg>
  );
}
