import { useLoginView } from '~/legacy/widgets/login-view/model/useLoginView';
import { LoginView } from '~/legacy/widgets/login-view/ui/LoginView';

export function LoginPage() {
  const view = useLoginView();

  return (
    <LoginView {...view} />
  );
}
