import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { apiOnAnotherHost } from './shared/config/env.schema';
import './index.css';
/** Says, in development, why the session would not survive a reload. */
function warnIfSessionCannotSurviveReload(): void {
  const apiUrl: unknown = import.meta.env.VITE_API_URL;

  if (
    import.meta.env.DEV &&
    typeof apiUrl === 'string' &&
    apiOnAnotherHost(apiUrl, location.hostname)
  ) {
    console.warn(
      `A interface está em ${location.hostname} e a API em ${new URL(apiUrl).hostname}. ` +
        'Com hosts diferentes o navegador descarta o cookie de renovação e a sessão se perde ' +
        `a cada F5. Abra a interface pelo mesmo endereço da API ou aponte VITE_API_URL para ${location.hostname}.`,
    );
  }
}

async function start(): Promise<void> {
  warnIfSessionCannotSurviveReload();

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
    'max-width:40rem;margin:4rem auto;padding:0 1rem;font-family:system-ui,sans-serif;color:var(--foreground)';
  const title = document.createElement('h1');
  title.style.cssText = 'font-size:1.25rem;margin:0 0 .75rem';
  title.textContent = 'O CraftStock não conseguiu iniciar';
  const explanation = document.createElement('p');
  explanation.style.cssText = 'margin:0 0 1rem;line-height:1.5';
  explanation.textContent =
    'Esta instalação está sem configuração. Quem instalou o sistema precisa corrigir isto:';
  const details = document.createElement('pre');
  details.style.cssText =
    'white-space:pre-wrap;background:var(--muted);padding:1rem;border-radius:.5rem;font-size:.8125rem;margin:0';
  details.textContent = detail;
  wrapper.append(title, explanation, details);
  target.replaceChildren(wrapper);
}
void start();
