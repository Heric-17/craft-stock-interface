import { Info } from 'lucide-react';

import { APP_VERSION } from '@/shared/config/app-info';
import { env } from '@/shared/config/env';
import { FormSection } from '@/shared/ui/form-section';

import { DetailList } from './detail-list';

/** Which build this is and which API it talks to: what to read out when asking for help. */
export function AboutSection() {
  return (
    <FormSection
      title="Sobre"
      description="Informações para quando você precisar falar com o suporte."
      icon={Info}
    >
      <DetailList
        label="Sobre o sistema"
        items={[
          { term: 'Empresa', detail: env.VITE_COMPANY_NAME },
          { term: 'Versão do sistema', detail: APP_VERSION },
          { term: 'Endereço da API', detail: env.VITE_API_URL },
        ]}
      />
    </FormSection>
  );
}
