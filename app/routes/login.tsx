import type { MetaFunction } from 'react-router';
import { LoginPage } from '~/pages/login/ui/LoginPage';

export const meta: MetaFunction = () => ([
  { title: 'Login - Local Streamer' },
  { name: 'description', content: 'Sign in to your Local Streamer account' },
]);

export default function LoginRoute() {
  return <LoginPage />;
}
