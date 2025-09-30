import { useLoginView } from '~/widgets/login-view/model/useLoginView';
import { LoginView } from '~/widgets/login-view/ui/LoginView';

export function LoginPage() {
  const view = useLoginView();

  return (
    <LoginView {...view} />
  );
}
