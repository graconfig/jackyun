import path from 'path'
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import type { Logger } from './gateway-service'

const logFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level.toUpperCase()}] ${message}`
})

const winstonInstance = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    logFormat
  ),
  transports: [
    new winston.transports.Console(),
    new DailyRotateFile({
      dirname: path.join(process.cwd(), 'logs'),
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      zippedArchive: false,
    }),
  ],
})

export const winstonLogger: Logger = {
  info: (message: string) => winstonInstance.info(message),
  error: (message: string) => winstonInstance.error(message),
}
