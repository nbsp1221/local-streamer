import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { AddVideosPage } from '~/pages/add-videos/ui/AddVideosPage';
import { requireAuth } from '~/utils/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAuth(request);
  return {};
}

export const meta: MetaFunction = () => ([
  { title: 'Add Videos - Local Streamer' },
  { name: 'description', content: 'Add new videos to your library' },
]);

export default function AddVideosRoute() {
  return <AddVideosPage />;
}
