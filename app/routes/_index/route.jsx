import { redirect } from "react-router";
import { authenticate } from "../../shopify.server";

export async function loader({ request }) {
  const url = new URL(request.url);
  
  // Authenticate the request
  await authenticate.admin(request);
  
  // Get all query parameters (includes shop, host, embedded, etc.)
  const searchParams = url.search;
  
  // Redirect to /app with all query parameters preserved
  throw redirect(`/app${searchParams}`);
}

export default function Index() {
  return null;
}