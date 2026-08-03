import { handler } from '../server/handlers/login.mjs';
import { vercelHandler } from '../server/lib/vercel-adapter.mjs';

export default vercelHandler(handler);
