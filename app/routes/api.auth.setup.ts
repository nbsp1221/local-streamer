import type { ActionFunctionArgs } from 'react-router';

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json(
      { success: false, error: 'Method not allowed' },
      { status: 405 },
    );
  }

  return Response.json(
    {
      success: false,
      error: 'Setup is no longer used. Configure AUTH_SHARED_PASSWORD instead.',
    },
    { status: 410 },
  );
}
