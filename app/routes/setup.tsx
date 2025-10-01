import type { MetaFunction } from 'react-router';
import { SetupPage } from '~/pages/setup/ui/SetupPage';

export const meta: MetaFunction = () => ([
  { title: 'Setup - Local Streamer' },
  { name: 'description', content: 'Set up your Local Streamer admin account' },
]);

export default function SetupRoute() {
  return <SetupPage />;
}
