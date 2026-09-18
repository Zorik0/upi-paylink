// The service worker normally intercepts share-target POSTs. This only runs if
// it isn't active yet (e.g. the very first launch), so send the user home.
export function POST(request: Request) {
  return Response.redirect(new URL("/?shared=error", request.url), 303);
}
