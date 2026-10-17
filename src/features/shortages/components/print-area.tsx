import { createPortal } from 'react-dom';

/**
 * The text of the list, laid out for paper. It is drawn straight into the
 * `<body>`, outside the application's root, and is invisible on screen. The
 * print stylesheet in `index.css` hides every other child of the `<body>` and
 * shows this one, so what comes out of the printer is the list and nothing else
 * — not the menu, not the panel it was generated in — whatever the layout of
 * the screen it was asked from.
 */
export function PrintArea({ text }: { text: string }) {
  return createPortal(
    <div data-print-area="" className="hidden">
      {text}
    </div>,
    document.body,
  );
}
