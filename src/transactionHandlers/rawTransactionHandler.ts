import {
  BaseError,
  type Account,
  type Chain,
  type PrepareTransactionRequestParameters,
  type PrepareTransactionRequestRequest,
  type PublicClient,
  type RpcSchema,
  type SendTransactionParameters,
  type Transport,
  type WalletClient,
} from "viem";
import type { TransactionHandler } from "./transactionHandler.js";

export type RawTransactionHandlerInput<
  chain extends Chain = Chain,
  account extends Account = Account,
  request extends PrepareTransactionRequestRequest<
    chain,
    chain
  > = PrepareTransactionRequestRequest<chain, chain>,
  pcTransport extends Transport = Transport,
  pcAccountOrAddress extends Account | undefined = undefined,
  pcRpcSchema extends RpcSchema | undefined = undefined,
  wcTransport extends Transport = Transport,
  wcRpcSchema extends RpcSchema | undefined = undefined,
> = {
  publicClient: PublicClient<
    pcTransport,
    chain,
    pcAccountOrAddress,
    pcRpcSchema
  >;
  walletClient: WalletClient<wcTransport, chain, account, wcRpcSchema>;

  rawCall: PrepareTransactionRequestParameters<
    chain,
    account,
    chain,
    account,
    request
  >;
};

export type RawTransactionHandlerOutput<
  chain extends Chain = Chain,
  account extends Account = Account,
  request extends PrepareTransactionRequestRequest<
    chain,
    chain
  > = PrepareTransactionRequestRequest<chain, chain>,
  wcTransport extends Transport = Transport,
  wcRpcSchema extends RpcSchema | undefined = undefined,
> = {
  walletClient: WalletClient<wcTransport, chain, account, wcRpcSchema>;
  rawCall: SendTransactionParameters<chain, account, chain, request>;
};

export type RawTransactionHandler<
  chain extends Chain = Chain,
  account extends Account = Account,
  request extends PrepareTransactionRequestRequest<
    chain,
    chain
  > = PrepareTransactionRequestRequest<chain, chain>,
  pcTransport extends Transport = Transport,
  pcAccountOrAddress extends Account | undefined = undefined,
  pcRpcSchema extends RpcSchema | undefined = undefined,
  wcTransport extends Transport = Transport,
  wcRpcSchema extends RpcSchema | undefined = undefined,
> = TransactionHandler<
  RawTransactionHandlerInput<
    chain,
    account,
    request,
    pcTransport,
    pcAccountOrAddress,
    pcRpcSchema,
    wcTransport,
    wcRpcSchema
  >,
  RawTransactionHandlerOutput<chain, account, request, wcTransport, wcRpcSchema>
>;

export function getRawTransactionHandler<
  chain extends Chain = Chain,
  account extends Account = Account,
  request extends PrepareTransactionRequestRequest<
    chain,
    chain
  > = PrepareTransactionRequestRequest<chain, chain>,
  pcTransport extends Transport = Transport,
  pcAccountOrAddress extends Account | undefined = undefined,
  pcRpcSchema extends RpcSchema | undefined = undefined,
  wcTransport extends Transport = Transport,
  wcRpcSchema extends RpcSchema | undefined = undefined,
>(): RawTransactionHandler<
  chain,
  account,
  request,
  pcTransport,
  pcAccountOrAddress,
  pcRpcSchema,
  wcTransport,
  wcRpcSchema
> {
  return {
    async simulate(input, settings) {
      const transaction = {
        account: input.walletClient.account,
        chain: input.walletClient.chain,
        ...input.rawCall,
      };
      if (!settings?.simulate) {
        return {
          walletClient: input.walletClient,
          rawCall: transaction as SendTransactionParameters<
            chain,
            account,
            chain,
            request
          >,
        };
      }

      return await input.publicClient
        .prepareTransactionRequest(
          transaction as PrepareTransactionRequestParameters<
            chain,
            account,
            chain,
            account,
            request
          >
        )
        .then((transactionRequest) => {
          return {
            walletClient: input.walletClient,
            rawCall: {
              ...transaction,
              ...transactionRequest,
            } as SendTransactionParameters<chain, account, chain, request>,
          };
        })
        .catch((err) => {
          let errorName = "Simulation failed.";
          if (err instanceof BaseError) {
            errorName = err.shortMessage ?? errorName;
          }
          settings?.loggers?.onError?.({
            title: `${settings?.transactionName ?? "Transaction"} failed`,
            description: errorName,
            error: err,
          });
          return undefined;
        });
    },

    async submit(input, settings) {
      return await input.walletClient
        .sendTransaction(input.rawCall)
        .catch((err) => {
          settings?.loggers?.onError?.({
            title: `${settings?.transactionName ?? "Transaction"} failed`,
            description: "Transaction rejected.",
            error: err,
          });
          return undefined;
        });
    },
  };
}
