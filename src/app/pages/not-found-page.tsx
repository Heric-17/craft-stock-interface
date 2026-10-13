import { Link } from 'react-router';
import { Button } from '@/shared/ui/button';
export function NotFoundPage() {
  return (
    <section className="flex flex-col items-start gap-4 py-12">
      <h1 className="text-xl font-bold tracking-tight">Esta página não existe</h1>
      <p className="text-muted-foreground text-sm">
        O endereço que você abriu não corresponde a nenhuma tela do sistema.
      </p>
      <Button asChild variant="outline">
        <Link to="/">Voltar ao início</Link>
      </Button>
    </section>
  );
}
