import type { Hash } from "viem";

export interface LoggerItem {
  title: string;
  description: string;
}

export interface LoggerItemError extends LoggerItem {
  error?: any;
}

export enum UpdateDuration {
  Short,
  Long,
}
export interface ViewTransactionUpdate {
  type: "ViewTransactionUpdate";
  transactionHash: Hash;
}
export type UpdateType = ViewTransactionUpdate;
export interface LoggerItemUpdate extends LoggerItem {
  updateDuration?: UpdateDuration;
  updateType?: UpdateType;
}

export type LoggerFunction<T extends LoggerItem> = (item: T) => void;

export interface Loggers {
  onError?: LoggerFunction<LoggerItemError>;
  onUpdate?: LoggerFunction<LoggerItemUpdate>;
  onSuccess?: LoggerFunction<LoggerItem>;
}

export const defaultOnError: LoggerFunction<LoggerItemError> = (item) =>
  console.error(`${item.title}: ${item.description}\n${item.error}`);

export const defaultOnUpdate: LoggerFunction<LoggerItemUpdate> = (item) =>
  console.log(`${item.title}: ${item.description}`);

export const defaultOnSuccess: LoggerFunction<LoggerItem> = (item) =>
  alert(`${item.title}: ${item.description}`);
