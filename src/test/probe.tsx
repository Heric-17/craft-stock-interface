import { useQuery } from '@tanstack/react-query';

import { ErrorState } from '@/shared/ui/error-state';

import { probeRequest } from './probe-request';

/** Loads `path` and shows either "carregado" or the real error state. */
export function ProbeQuery({ path = '/probe' }: { path?: string }) {
  const query = useQuery({
    queryKey: ['probe', path],
    queryFn: () => probeRequest(path),
    // The retry policy has its own test; here the first answer is the answer.
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
