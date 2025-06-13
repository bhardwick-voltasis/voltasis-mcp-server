import winston from 'winston';

const isDevelopment = process.env.NODE_ENV !== 'production';

// In production (MCP mode), we need to avoid console output
// as it interferes with JSON-RPC communication
const transports: winston.transport[] = [];

if (isDevelopment) {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  );
} else {
  // In production, log to a file instead of console
  transports.push(
    new winston.transports.File({
      filename: '/tmp/voltasis-mcp-server.log',
      format: winston.format.json()
    })
  );
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'voltasis-mcp-server' },
  transports
});

// Create child logger for specific components
export const createLogger = (component: string) => {
  return logger.child({ component });
}; 