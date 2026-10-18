import { UserRound } from 'lucide-react';

import { useSession } from '@/features/auth';
import { FormSection } from '@/shared/ui/form-section';

import { DetailList } from './detail-list';

/**
 * Who is signed in, from the answer to the login and the refresh. There is no
 * second request for it: the session already holds the name and the e-mail, and
 * the API has no way to change either.
 */
export function AccountSection() {
  const session = useSession();

  return (
    <FormSection
      title="Sua conta"
      description="A conta com que você está usando o sistema agora."
      icon={UserRound}
    >
      {session.status === 'authenticated' ? (
        <DetailList
          label="Dados da sua conta"
          items={[
            { term: 'Nome', detail: session.user.name },
            { term: 'E-mail', detail: session.user.email },
          ]}
        />
      ) : (
        <p className="text-muted-foreground text-sm">Os dados da conta não estão disponíveis.</p>
      )}
    </FormSection>
  );
}
