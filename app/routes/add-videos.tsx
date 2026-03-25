import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { requireProtectedPageSession } from '~/composition/server/auth';
import { AddVideosPage } from '~/pages/add-videos/ui/AddVideosPage';

export async function loader({ request }: LoaderFunctionArgs) {
  await requireProtectedPageSession(request);
  return {};
}

export const meta: MetaFunction = () => ([
  { title: 'Add Videos - Local Streamer' },
  { name: 'description', content: 'Add new videos to your library' },
]);

export default function AddVideosRoute() {
  return <AddVideosPage />;
}
