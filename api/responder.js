import { handler } from '../server/handlers/responder.mjs';
import { vercelHandler } from '../server/lib/vercel-adapter.mjs';

export default vercelHandler(handler);
