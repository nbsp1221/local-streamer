import { redirect, type LoaderFunctionArgs, type MetaFunction } from 'react-router';

export async function loader(_args: LoaderFunctionArgs) {
  throw redirect('/login');
}

export const meta: MetaFunction = () => ([
  { title: 'Setup - Local Streamer' },
  { name: 'description', content: 'Set up your Local Streamer admin account' },
]);

export default function SetupRoute() {
  return null;
}
