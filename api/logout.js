import { handler } from '../server/handlers/logout.mjs';
import { vercelHandler } from '../server/lib/vercel-adapter.mjs';

export default vercelHandler(handler);
