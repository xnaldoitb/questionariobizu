import { handler } from '../server/handlers/admin-catalogo.mjs';
import { vercelHandler } from '../server/lib/vercel-adapter.mjs';

export default vercelHandler(handler);
