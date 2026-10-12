import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';

/**
 * The configuration is read as the first thing that happens, and a build that
 * was never pointed at an API says so on the screen instead of failing later
 * with a network error that explains nothing.
 *
 * `./app/app` is imported dynamically for exactly that reason: a static import
 * would pull the environment module in before this file could catch anything.
 */
async function start(): Promise<void> {
  const container = document.getElementById('root');

  if (container === null) {
    throw new Error('Elemento #root não encontrado no index.html.');
  }

  try {
    const { App } = await import('./app/app');

    createRoot(container).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (error) {
    renderStartupFailure(container, error);
  }
}

function renderStartupFailure(target: HTMLElement, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);

  const wrapper = document.createElement('div');
  wrapper.setAttribute('role', 'alert');
  wrapper.style.cssText =
    'max-width:40rem;margin:4rem auto;padding:0 1rem;font-family:system-ui,sans-serif;color:#263a35';

  const title = document.createElement('h1');
  title.style.cssText = 'font-size:1.25rem;margin:0 0 .75rem';
  title.textContent = 'O CraftStock não conseguiu iniciar';

  const explanation = document.createElement('p');
  explanation.style.cssText = 'margin:0 0 1rem;line-height:1.5';
  explanation.textContent =
    'Esta instalação está sem configuração. Quem instalou o sistema precisa corrigir isto:';

  const details = document.createElement('pre');
  details.style.cssText =
    'white-space:pre-wrap;background:#f0f3f1;padding:1rem;border-radius:.5rem;font-size:.8125rem;margin:0';
  details.textContent = detail;

  wrapper.append(title, explanation, details);
  target.replaceChildren(wrapper);
}

void start();
