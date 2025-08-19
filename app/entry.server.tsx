import { PassThrough } from 'node:stream';
import type { RenderToPipeableStreamOptions } from 'react-dom/server';
import type { AppLoadContext, EntryContext } from 'react-router';
import { createReadableStreamFromReadable } from '@react-router/node';
import { isbot } from 'isbot';
import { ServerRouter } from 'react-router';

export const streamTimeout = 5_000;

// Detect Bun runtime
const isBun = typeof Bun !== 'undefined';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: AppLoadContext,
) {
  if (isBun) {
    // Bun runtime - use renderToReadableStream
    const { renderToReadableStream } = await import('react-dom/server.browser');

    const userAgent = request.headers.get('user-agent');
    const waitForAll = (userAgent && isbot(userAgent)) || routerContext.isSpaMode;

    const stream = await renderToReadableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        signal: AbortSignal.timeout(streamTimeout),
        onError(error: unknown) {
          console.error('Streaming render error:', error);
          responseStatusCode = 500;
        },
      },
    );

    if (waitForAll) {
      await stream.allReady;
    }

    responseHeaders.set('Content-Type', 'text/html');

    return new Response(stream, {
      headers: responseHeaders,
      status: responseStatusCode,
    });
  }
  else {
    // Node.js runtime - use renderToPipeableStream
    const { renderToPipeableStream } = await import('react-dom/server');

    return new Promise((resolve, reject) => {
      let shellRendered = false;
      const userAgent = request.headers.get('user-agent');

      const readyOption: keyof RenderToPipeableStreamOptions =
        (userAgent && isbot(userAgent)) || routerContext.isSpaMode
          ? 'onAllReady'
          : 'onShellReady';

      const { pipe, abort } = renderToPipeableStream(
        <ServerRouter context={routerContext} url={request.url} />,
        {
          [readyOption]() {
            shellRendered = true;
            const body = new PassThrough();
            const stream = createReadableStreamFromReadable(body);

            responseHeaders.set('Content-Type', 'text/html');

            resolve(
              new Response(stream, {
                headers: responseHeaders,
                status: responseStatusCode,
              }),
            );

            pipe(body);
          },
          onShellError(error: unknown) {
            reject(error);
          },
          onError(error: unknown) {
            responseStatusCode = 500;
            if (shellRendered) {
              console.error(error);
            }
          },
        },
      );

      setTimeout(abort, streamTimeout + 1000);
    });
  }
}
