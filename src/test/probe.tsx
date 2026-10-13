import { useQuery } from '@tanstack/react-query';
import { ErrorState } from '@/shared/ui/error-state';
import { probeRequest } from './probe-request';
export function ProbeQuery({ path = '/probe' }: { path?: string }) {
  const query = useQuery({
    queryKey: ['probe', path],
    queryFn: () => probeRequest(path),
    retry: false,
  });
  if (query.isPending) {
    return <p>Carregando…</p>;
  }
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  return <p>carregado</p>;
}
