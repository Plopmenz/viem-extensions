import type { Hex } from "viem";
import type { Loggers } from "../loggers.js";

export interface TransactionHandlerSettings {
  loggers?: Loggers;

  transactionName?: string;
  simulate?: boolean;
}

export interface TransactionHandler<Input, Output> {
  simulate(
    input: Input,
    settings?: TransactionHandlerSettings
  ): Promise<Output | undefined>;
  submit(
    input: Output,
    settings?: TransactionHandlerSettings
  ): Promise<Hex | undefined>; // transaction hash
}
