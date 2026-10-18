import { PageHeader } from '@/shared/ui/page-header';

import { AboutSection } from '../components/about-section';
import { AccountSection } from '../components/account-section';
import { ChangePasswordForm } from '../components/change-password-form';

/** The account in use, its password, and which build this is. */
export function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        description="Sua conta, a senha de acesso e informações sobre o sistema."
      />
      <div className="flex max-w-2xl flex-col gap-6">
        <AccountSection />
        <ChangePasswordForm />
        <AboutSection />
      </div>
    </div>
  );
}
