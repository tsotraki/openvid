import serverless from 'serverless-http';
import app from '../../server.js';

// Handle ESM default export interop
const expressApp = app.default || app;

export const handler = serverless(expressApp);
