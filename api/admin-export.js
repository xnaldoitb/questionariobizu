import { handler } from '../server/handlers/admin-export.mjs';
import { vercelHandler } from '../server/lib/vercel-adapter.mjs';

export default vercelHandler(handler);
