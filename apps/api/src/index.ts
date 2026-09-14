import { buildServer } from "./server.js";
import { env } from "./env.js";
import { prisma } from "@repo/db";

const app = buildServer();

// Graceful shutdown handlers
async function gracefulShutdown(signal: string) {
  app.log.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close HTTP server (stop accepting new connections)
    await app.close();
    app.log.info('HTTP server closed');
    
    // Disconnect from database
    await prisma.$disconnect();
    app.log.info('Database connection closed');
    
    app.log.info('Graceful shutdown completed');
    process.exit(0);
  } catch (err) {
    app.log.error(`Error during graceful shutdown: ${err}`);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  app.log.error(`Uncaught exception: ${err}`);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  app.log.error(`Unhandled rejection: ${reason}`);
  gracefulShutdown('unhandledRejection');
});

app.listen({ port: env.PORT ?? 3001, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
