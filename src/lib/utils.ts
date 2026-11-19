import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// tailwind-merge only knows Tailwind's built-in scales. Our custom font sizes
// (text-display-1, text-label, ...) look to it like text COLOUR utilities, so
// it would treat `text-label` and `text-[var(--eyebrow-color)]` as conflicting
// and silently drop one. Teaching it the scale keeps size and colour in
// separate groups, which is what lets a component set both.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display-1",
            "display-2",
            "display-3",
            "heading",
            "body",
            "body-sm",
            "caption",
            "label",
            "metric",
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
